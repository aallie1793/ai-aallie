import OpenAI from 'openai'

// Initialize OpenAI client
const getOpenAIClient = () => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API key is not set. Please set VITE_OPENAI_API_KEY in your .env file')
  }
  return new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true // Note: In production, use a backend API
  })
}

// Extract text from HTML
const extractTextFromHTML = (html: string): string => {
  if (!html || html.trim().length === 0) {
    return ''
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    
    // Check for parsing errors
    const parserError = doc.querySelector('parsererror')
    if (parserError) {
      console.warn('HTML parsing error, trying alternative extraction')
      // Fallback: use regex to extract text
      return extractTextWithRegex(html)
    }
    
    // Remove script and style elements
    const scripts = doc.querySelectorAll('script, style, noscript, iframe, embed, object')
    scripts.forEach(el => el.remove())
    
    // Try to get main content from common semantic elements
    const mainContent = doc.querySelector('main, article, [role="main"]') || doc.body
    
    // Get text content with better formatting
    let text = ''
    
    // Try textContent first
    text = mainContent.textContent || ''
    
    // If textContent is empty, try innerText
    if (!text || text.trim().length === 0) {
      text = (mainContent as HTMLElement).innerText || ''
    }
    
    // Clean up the text
    text = text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim()
    
    // If still no text, try regex extraction
    if (!text || text.length < 50) {
      console.warn('Minimal text extracted, trying regex fallback')
      const regexText = extractTextWithRegex(html)
      if (regexText && regexText.length > text.length) {
        text = regexText
      }
    }
    
    return text
  } catch (error) {
    console.error('Error extracting text from HTML:', error)
    // Fallback to regex extraction
    return extractTextWithRegex(html)
  }
}

// Fallback: Extract text using regex (removes HTML tags)
const extractTextWithRegex = (html: string): string => {
  // Remove script and style tags and their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  
  // Decode HTML entities
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  text = textarea.value
  
  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
  
  return text
}

// Use GPT to extract content from HTML when regular extraction fails
const extractContentWithGPT = async (html: string, url: string): Promise<string> => {
  try {
    const openai = getOpenAIClient()
    
    // For JavaScript-rendered content, we need to process more HTML
    // Limit HTML size to avoid token limits (keep first 100k characters for better extraction)
    const limitedHtml = html.substring(0, 100000)
    
    console.log(`📤 Sending ${limitedHtml.length} characters of HTML to GPT for extraction`)
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a web content extraction assistant. Your task is to extract ALL meaningful text content from the provided HTML page.

IMPORTANT INSTRUCTIONS:
- Extract ALL visible text content from the HTML
- Remove HTML tags, scripts, styles, and navigation elements
- Preserve the structure and meaning of the content
- Include all text from headings, paragraphs, lists, buttons, links, etc.
- Extract text from data attributes, meta tags, and other content sources
- For JavaScript-rendered content, extract text from script tags if it contains content
- Return comprehensive text content that captures all information on the page
- Preserve important details like names, descriptions, features, services, etc.

Return only the extracted text content that would be useful for training a chatbot.`
        },
        {
          role: 'user',
          content: `Extract ALL meaningful text content from this HTML page (URL: ${url}). The page may contain JavaScript-rendered content, so extract everything you can find:\n\n${limitedHtml}`
        }
      ],
      max_tokens: 8000, // Increased to allow more comprehensive extraction
      temperature: 0.3
    })
    
    const extractedText = response.choices[0]?.message?.content || ''
    console.log(`📥 GPT extracted ${extractedText.length} characters of text content`)
    return extractedText.trim()
  } catch (error) {
    console.error('Error using GPT to extract content:', error)
    throw error
  }
}

// Scrape website using Zyte API
const scrapeWithZyte = async (url: string): Promise<string> => {
  const apiKey = import.meta.env.VITE_ZYTE_API_KEY || import.meta.env.VITE_ZITE_API_KEY
  
  if (!apiKey) {
    throw new Error('Zyte API key not found. Please set VITE_ZYTE_API_KEY in your .env file')
  }

  console.log('🔧 Using Zyte API for scraping...')
  
  try {
    // Zyte API endpoint
    const zyteApiUrl = 'https://api.zyte.com/v1/extract'
    
    // Zyte API uses Basic authentication with API key as username and empty password
    const authHeader = `Basic ${btoa(`${apiKey}:`)}`
    
    const response = await fetch(zyteApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        url: url,
        browserHtml: true // Get JavaScript-rendered content (handles SPAs)
        // Note: Cannot use both browserHtml and httpResponseBody in the same request
      })
    })

    if (!response.ok) {
      let errorText = ''
      try {
        const errorData = await response.json()
        errorText = JSON.stringify(errorData)
      } catch {
        errorText = await response.text()
      }
      throw new Error(`Zyte API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    
    console.log('📦 Zyte API Response:', {
      hasBrowserHtml: !!data.browserHtml,
      browserHtmlLength: data.browserHtml?.length || 0,
      responseKeys: Object.keys(data),
      statusCode: data.statusCode,
      url: data.url
    })
    
    // Zyte returns the HTML in browserHtml (JavaScript-rendered content)
    let html = ''
    
    if (data.browserHtml) {
      html = data.browserHtml
      console.log('📄 Using browserHtml (JavaScript-rendered content)')
      console.log('📝 HTML Preview (first 500 chars):', html.substring(0, 500))
      console.log('📝 HTML Preview (last 200 chars):', html.substring(Math.max(0, html.length - 200)))
    } else {
      console.error('❌ Zyte API response structure:', JSON.stringify(data, null, 2))
      throw new Error('Zyte API response does not contain browserHtml content')
    }
    
    if (!html || html.length < 100) {
      console.error('❌ Insufficient HTML content:', {
        htmlLength: html.length,
        htmlPreview: html.substring(0, 200)
      })
      throw new Error(`Zyte API returned insufficient HTML content (${html.length} characters)`)
    }

    console.log(`✅ Successfully fetched HTML using Zyte API: ${html.length} characters`)
    console.log('📊 HTML Statistics:', {
      totalLength: html.length,
      hasDoctype: html.includes('<!DOCTYPE'),
      hasHtmlTag: html.includes('<html'),
      hasBodyTag: html.includes('<body'),
      hasScriptTags: (html.match(/<script/gi) || []).length,
      hasStyleTags: (html.match(/<style/gi) || []).length
    })
    
    return html
  } catch (error) {
    console.error('❌ Zyte API scraping failed:', error)
    throw error
  }
}

// Scrape website content
export const scrapeWebsite = async (url: string): Promise<string> => {
  console.log('🔍 Starting website scraping for URL:', url)
  
  try {
    // Ensure URL has protocol
    let targetUrl = url.trim()
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`
    }
    
    console.log('📝 Target URL:', targetUrl)

    let html = ''
    let lastError: Error | null = null

    // Try Zyte API first (if API key is available)
    const zyteApiKey = import.meta.env.VITE_ZYTE_API_KEY || import.meta.env.VITE_ZITE_API_KEY
    if (zyteApiKey) {
      try {
        html = await scrapeWithZyte(targetUrl)
      } catch (zyteError) {
        console.warn('⚠️ Zyte API failed, falling back to CORS proxies:', zyteError)
        lastError = zyteError instanceof Error ? zyteError : new Error('Zyte API error')
      }
    } else {
      console.log('ℹ️ Zyte API key not found, using CORS proxies')
    }

    // If Zyte failed or not available, try CORS proxies as fallback
    if (!html || html.length === 0) {
      const corsProxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
      ]

      // Try each proxy until one works
      for (let i = 0; i < corsProxies.length; i++) {
        const proxyUrl = corsProxies[i]
        console.log(`🌐 Trying CORS proxy ${i + 1}/${corsProxies.length}: ${proxyUrl}`)
        
        try {
          const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
          })
          
          console.log(`📡 Response status: ${response.status} ${response.statusText}`)
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          
          const fetchedHtml = await response.text()
          console.log(`📄 Fetched HTML length: ${fetchedHtml.length} characters`)
          
          // Check if we got valid HTML content
          if (fetchedHtml && fetchedHtml.length > 100) {
            // Verify it's actually HTML (not an error page)
            if (fetchedHtml.includes('<html') || fetchedHtml.includes('<body') || fetchedHtml.includes('<!DOCTYPE')) {
              html = fetchedHtml
              console.log(`✅ Successfully fetched HTML using proxy: ${proxyUrl}`)
              break
            } else {
              console.warn(`⚠️ Proxy returned non-HTML content (might be JSON or error): ${proxyUrl}`)
              console.log('First 200 chars:', fetchedHtml.substring(0, 200))
            }
          } else {
            console.warn(`⚠️ Fetched content too short: ${fetchedHtml.length} characters`)
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error')
          console.warn(`❌ CORS proxy ${i + 1} failed:`, error)
          // Continue to next proxy
          continue
        }
      }
    }

    // If all proxies failed, throw an error
    if (!html || html.length === 0) {
      const errorMsg = lastError 
        ? `All CORS proxy services failed. Last error: ${lastError.message}`
        : 'All CORS proxy services failed. No HTML content received.'
      console.error('❌', errorMsg)
      throw new Error(
        `Failed to scrape website: ${errorMsg} ` +
        'This is likely due to CORS restrictions. Please try using a different source or manually paste the content.'
      )
    }
    
    console.log('🔧 Extracting text from HTML...')
    let textContent = extractTextFromHTML(html)
    const extractionRatio = ((textContent?.length || 0) / html.length * 100).toFixed(2)
    console.log(`📝 Extracted text length: ${textContent?.length || 0} characters`)
    console.log(`📊 Extraction ratio: ${extractionRatio}% (${textContent?.length || 0} / ${html.length})`)
    
    // If extraction ratio is very low (< 5%), it likely means the content is JavaScript-rendered
    // In that case, use GPT to extract content directly from HTML
    const extractionRatioNum = parseFloat(extractionRatio)
    if (extractionRatioNum < 5 || !textContent || textContent.trim().length < 500) {
      console.warn(`⚠️ Low extraction ratio (${extractionRatio}%), using GPT to extract content from HTML`)
      console.log('HTML length:', html.length, 'Extracted text length:', textContent?.length || 0)
      console.log('Extracted text preview:', textContent?.substring(0, 200))
      
      // Try using GPT to extract content from the HTML
      try {
        console.log('🤖 Using GPT to extract content from HTML (this may take a moment)...')
        textContent = await extractContentWithGPT(html, targetUrl)
        if (textContent && textContent.trim().length >= 500) {
          const gptRatio = (textContent.length / html.length * 100).toFixed(2)
          console.log(`✅ Successfully extracted ${textContent.length} characters using GPT (${gptRatio}% of HTML)`)
          return textContent
        } else {
          console.warn('⚠️ GPT extraction returned insufficient content')
        }
      } catch (gptError) {
        console.error('❌ GPT extraction failed:', gptError)
      }
      
      // If GPT extraction also fails but we have some text, use what we have
      if (textContent && textContent.trim().length >= 50) {
        console.warn('⚠️ Using limited extracted text (GPT extraction failed)')
        return textContent
      }
      
      // If GPT extraction also fails, throw error with helpful message
      console.error('❌ Extracted text is too short:', textContent?.substring(0, 100))
      throw new Error(
        'No meaningful text content could be extracted from the website. ' +
        'The website might be using JavaScript to load content dynamically. ' +
        'Please try manually pasting the content or use a different source.'
      )
    }
    
    console.log(`✅ Successfully extracted ${textContent.length} characters from website (${extractionRatio}% of HTML)`)
    return textContent
  } catch (error) {
    console.error('Error scraping website:', error)
    throw new Error(`Failed to scrape website: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Process PDF or Word document file
export const processPDF = async (file: File): Promise<string> => {
  try {
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    const fileType = file.type
    
    console.log('📄 Processing file:', {
      fileName: file.name,
      fileExtension,
      fileType,
      fileSize: file.size
    })
    
    // Check if it's a Word document (.doc or .docx)
    if (fileExtension === '.docx' || fileExtension === '.doc' || 
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileType === 'application/msword') {
      console.log('📝 Processing Word document...')
      return await processWordDocument(file)
    }
    
    // Otherwise, process as PDF
    console.log('📄 Processing PDF document...')
    return await processPDFDocument(file)
  } catch (error) {
    console.error('Error processing file:', error)
    throw new Error(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Process PDF document
const processPDFDocument = async (file: File): Promise<string> => {
  try {
    // Dynamically import pdfjs-dist
    const pdfjsLib = await import('pdfjs-dist')
    
    // Set worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
    
    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer()
    
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    
    // Extract text from all pages
    let fullText = ''
    const numPages = pdf.numPages
    
    console.log(`📄 PDF has ${numPages} pages`)
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      
      // Combine all text items
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      
      fullText += pageText + '\n\n'
    }
    
    if (!fullText.trim()) {
      throw new Error('No text could be extracted from the PDF')
    }
    
    console.log(`✅ Extracted ${fullText.length} characters from PDF`)
    return fullText.trim()
  } catch (error) {
    console.error('Error processing PDF:', error)
    throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Process Word document (.doc or .docx)
const processWordDocument = async (file: File): Promise<string> => {
  try {
    // Dynamically import mammoth for Word document processing
    const mammoth = await import('mammoth')
    
    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer()
    
    // Convert Word document to HTML/text
    const result = await mammoth.extractRawText({ arrayBuffer })
    
    if (!result.value || !result.value.trim()) {
      throw new Error('No text could be extracted from the Word document')
    }
    
    console.log(`✅ Extracted ${result.value.length} characters from Word document`)
    
    // Log warnings if any
    if (result.messages && result.messages.length > 0) {
      console.warn('⚠️ Word document processing warnings:', result.messages)
    }
    
    return result.value.trim()
  } catch (error) {
    console.error('Error processing Word document:', error)
    throw new Error(`Failed to process Word document: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Process knowledge base with GPT
// OPTIMIZED: Only processes content if it's too long or needs structuring
// For well-structured content, we can use it directly
export const processKnowledgeBase = async (
  content: string,
  sourceType: 'link' | 'pdf' | 'instagram' | 'linkedin' | 'facebook' | 'tiktok'
): Promise<string> => {
  try {
    const sourceDescription = {
      link: 'website content',
      pdf: 'PDF or Google Doc document',
      instagram: 'Instagram profile',
      linkedin: 'LinkedIn profile',
      facebook: 'Facebook profile',
      tiktok: 'TikTok profile'
    }[sourceType]
    
    console.log('📊 Content statistics:', {
      totalLength: content.length,
      sourceType: sourceDescription
    })
    
    // OPTIMIZATION: For well-structured content (PDFs, Word docs), use directly
    // Only process with GPT if content is very long or unstructured
    const maxDirectLength = 50000 // Use content directly if under 50k chars
    
    if (content.length <= maxDirectLength && (sourceType === 'pdf' || sourceType === 'link')) {
      console.log('✅ Using content directly (well-structured, no GPT processing needed)')
      // Clean and structure the content slightly without GPT call
      const cleanedContent = content
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim()
      
      return cleanedContent
    }
    
    // Only use GPT for very long or unstructured content
    console.log('🤖 Processing knowledge base with GPT (content too long or unstructured)...')
    
    const openai = getOpenAIClient()
    
    // For website content, we want to preserve as much context as possible
    const maxContentLength = sourceType === 'link' ? 150000 : 100000
    const contentToProcess = content.substring(0, maxContentLength)
    
    if (content.length > maxContentLength) {
      console.warn(`⚠️ Content truncated from ${content.length} to ${maxContentLength} characters`)
    }
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that processes knowledge bases. Your task is to analyze and structure the provided content from a ${sourceDescription}. 

IMPORTANT INSTRUCTIONS:
- Extract ALL key information, topics, features, and details from the content
- Preserve important facts, data, and specific information
- Create a comprehensive knowledge base that captures the essence of the content
- Structure the knowledge base in a way that will help a chatbot answer questions accurately
- Include specific details like names, dates, features, services, products, etc.
- Maintain context and relationships between different pieces of information
- Return a well-structured knowledge base that can be used for answering user questions

Return a comprehensive, structured summary of the knowledge base that preserves all important information.`
        },
        {
          role: 'user',
          content: `Please process the following ${sourceDescription} and create a comprehensive knowledge base. Extract and preserve all important information:\n\n${contentToProcess}`
        }
      ],
      max_tokens: 8000,
      temperature: 0.3
    })
    
    const processedKB = response.choices[0]?.message?.content || ''
    console.log('✅ Knowledge base processed:', {
      originalLength: content.length,
      processedLength: processedKB.length,
      tokensUsed: response.usage?.total_tokens || 'unknown'
    })
    
    return processedKB
  } catch (error) {
    console.error('Error processing knowledge base:', error)
    throw new Error(`Failed to process knowledge base: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Chat with GPT using the knowledge base
export const chatWithGPT = async (
  message: string,
  knowledgeBase: string
): Promise<string> => {
  try {
    const openai = getOpenAIClient()
    
    // Use more of the knowledge base context (increased from 8000 to 20000 chars)
    // This ensures more website information is available to GPT
    const kbContext = knowledgeBase.substring(0, 20000)
    
    console.log('💬 Chatting with GPT:', {
      messageLength: message.length,
      knowledgeBaseLength: knowledgeBase.length,
      contextUsed: kbContext.length,
      contextPercentage: ((kbContext.length / knowledgeBase.length) * 100).toFixed(1) + '%'
    })
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a helpful AI assistant chatbot. You have been trained on the following knowledge base extracted from a website. Answer questions based on this knowledge base. 

IMPORTANT INSTRUCTIONS:
- Answer questions using ONLY the information from the knowledge base below
- Be specific and accurate - cite details from the knowledge base
- If the knowledge base doesn't contain the answer, politely say you don't have that information
- Use the knowledge base to provide comprehensive, detailed answers
- Reference specific features, services, or information from the knowledge base when relevant

IMPORTANT FORMATTING RULES:
- Format your responses using Markdown for better readability
- Use bullet points (- or *) for lists
- Use numbered lists (1., 2., 3.) for sequential items
- Use **bold** for emphasis on important terms
- Use line breaks (\\n\\n) to separate paragraphs
- Use ### for section headings when appropriate
- Keep responses well-structured and easy to read
- Break up long paragraphs into shorter ones

Keep responses informative but concise. Always format your answers properly using Markdown.

Knowledge Base (extracted from website):
${kbContext}`
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 1500, // Increased for more detailed responses
      temperature: 0.7
    })
    
    const botResponse = response.choices[0]?.message?.content || 'I apologize, but I could not generate a response.'
    
    console.log('✅ GPT Response generated:', {
      responseLength: botResponse.length,
      tokensUsed: response.usage?.total_tokens || 'unknown'
    })
    
    return botResponse
  } catch (error) {
    console.error('Error chatting with GPT:', error)
    throw new Error(`Failed to get response: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

