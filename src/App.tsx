import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { 
  Globe, FileText, Smartphone, Zap, Link2, FileUp, 
  Instagram, Linkedin, Facebook, Music, Sparkles, 
  Calendar, Mail, CheckCircle, AlertCircle, Upload,
  Brain, MessageCircle, ArrowRight
} from 'lucide-react'
import './App.css'
import { scrapeWebsite, processPDF, processKnowledgeBase, chatWithGPT } from './services/api'
import { scrapeInstagram, processInstagramContent } from './services/instagram'
import { scrapeLinkedIn, processLinkedInContent } from './services/linkedin'
import { scrapeFacebook, processFacebookContent } from './services/facebook'
import { scrapeTikTok, processTikTokContent } from './services/tiktok'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
}

function App() {
  const [step, setStep] = useState<'landing' | 'input' | 'chat' | 'conversion'>('landing')
  const [knowledgeSource, setKnowledgeSource] = useState<'link' | 'pdf' | 'instagram' | 'linkedin' | 'facebook' | 'tiktok' | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [knowledgeBase, setKnowledgeBase] = useState<string>('')
  const [email, setEmail] = useState('')
  const [showEmailForm, setShowEmailForm] = useState(false)

  const handleSourceSelect = (source: 'link' | 'pdf' | 'instagram' | 'linkedin' | 'facebook' | 'tiktok') => {
    setKnowledgeSource(source)
    setStep('input')
  }

  const handleSubmitKnowledge = async () => {
    if (!inputValue.trim() && !pdfFile) {
      console.warn('⚠️ No input value or PDF file provided')
      return
    }
    
    console.log('🚀 Starting knowledge base processing...')
    console.log('📋 Source type:', knowledgeSource)
    console.log('📝 Input value:', inputValue)
    console.log('📄 PDF file:', pdfFile?.name || 'none')
    
    setIsProcessing(true)
    setError(null)
    
    try {
      let rawContent = ''
      
      // Step 1: Scrape/Extract content based on source type
      if (knowledgeSource === 'link') {
        console.log('🔗 Processing website link:', inputValue)
        try {
          rawContent = await scrapeWebsite(inputValue)
          console.log('✅ Website scraping successful, content length:', rawContent.length)
        } catch (scrapeError) {
          console.error('Website scraping failed:', scrapeError)
          // If scraping fails, offer manual input option
          const errorMessage = scrapeError instanceof Error ? scrapeError.message : 'Unknown error'
          const shouldPaste = window.confirm(
            `Website scraping failed: ${errorMessage}\n\nWould you like to manually paste the website content instead?`
          )
          if (shouldPaste) {
            const pastedContent = prompt(
              'Please paste the website content you want to use for training the chatbot:\n\n(You can copy text from the website and paste it here)'
            )
            if (pastedContent && pastedContent.trim().length > 10) {
              rawContent = pastedContent.trim()
              console.log('Using manually pasted content')
            } else {
              throw new Error('No content provided or content is too short. Please paste the website content and try again.')
            }
          } else {
            throw new Error(`Website scraping failed: ${errorMessage}`)
          }
        }
      } else if (knowledgeSource === 'pdf' && pdfFile) {
        rawContent = await processPDF(pdfFile)
      } else if (knowledgeSource === 'instagram') {
        try {
          rawContent = await scrapeInstagram(inputValue)
        } catch (err) {
          // If scraping fails, allow manual content input
          const manualContent = prompt(
            'Instagram scraping requires backend setup. Please paste the content you want to use:'
          )
          if (manualContent) {
            rawContent = await processInstagramContent(manualContent)
          } else {
            throw new Error('No content provided')
          }
        }
      } else if (knowledgeSource === 'linkedin') {
        try {
          rawContent = await scrapeLinkedIn(inputValue)
        } catch (err) {
          // If scraping fails, allow manual content input
          const manualContent = prompt(
            'LinkedIn scraping requires backend setup. Please paste the content you want to use:'
          )
          if (manualContent) {
            rawContent = await processLinkedInContent(manualContent)
          } else {
            throw new Error('No content provided')
          }
        }
      } else if (knowledgeSource === 'facebook') {
        try {
          rawContent = await scrapeFacebook(inputValue)
        } catch (err) {
          // If scraping fails, allow manual content input
          const manualContent = prompt(
            'Facebook scraping requires backend setup. Please paste the content you want to use:'
          )
          if (manualContent) {
            rawContent = await processFacebookContent(manualContent)
          } else {
            throw new Error('No content provided')
          }
        }
      } else if (knowledgeSource === 'tiktok') {
        try {
          rawContent = await scrapeTikTok(inputValue)
        } catch (err) {
          // If scraping fails, allow manual content input
          const manualContent = prompt(
            'TikTok scraping requires backend setup. Please paste the content you want to use:'
          )
          if (manualContent) {
            rawContent = await processTikTokContent(manualContent)
          } else {
            throw new Error('No content provided')
          }
        }
      }
      
      if (!rawContent.trim()) {
        throw new Error('No content could be extracted. Please try again.')
      }
      
      // Step 2: Process content with GPT to create knowledge base
      const processedKnowledgeBase = await processKnowledgeBase(rawContent, knowledgeSource!)
      setKnowledgeBase(processedKnowledgeBase)
      
      // Step 3: Initialize chat
      setStep('chat')
      setMessages([{
        id: '1',
        text: `Hello! I'm your AI chatbot. I've been trained on your ${knowledgeSource === 'link' ? 'website content' : knowledgeSource === 'pdf' ? 'PDF or Google Doc document' : knowledgeSource === 'instagram' ? 'Instagram profile' : knowledgeSource === 'linkedin' ? 'LinkedIn profile' : knowledgeSource === 'facebook' ? 'Facebook profile' : 'TikTok profile'}. How can I help you today?`,
        sender: 'bot',
        timestamp: new Date()
      }])
    } catch (err) {
      console.error('Error processing knowledge base:', err)
      setError(err instanceof Error ? err.message : 'Failed to process knowledge base. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return

    // Count user messages (excluding the initial bot welcome message)
    const userMessageCount = messages.filter(m => m.sender === 'user').length
    
    // Limit to 3 user messages, after 4th message show conversion
    if (userMessageCount >= 3) {
      console.log('📊 Message limit reached (3 user messages), showing conversion modal')
      setStep('conversion')
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsProcessing(true)
    setError(null)

    try {
      // Get response from GPT using knowledge base
      const botResponse = await chatWithGPT(text, knowledgeBase)
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: 'bot',
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, botMessage])
      
      // After 3 user messages (4th message), show conversion
      const newUserMessageCount = messages.filter(m => m.sender === 'user').length + 1
      if (newUserMessageCount >= 3) {
        console.log('📊 Reached message limit, showing conversion modal in 2 seconds')
        setTimeout(() => {
          setStep('conversion')
        }, 2000)
      }
    } catch (err) {
      console.error('Error getting bot response:', err)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I apologize, but I'm having trouble processing your request right now. Please try again.",
        sender: 'bot',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      setError(err instanceof Error ? err.message : 'Failed to get response')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBookCall = () => {
    window.open('https://calendly.com/your-link', '_blank')
  }

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim()) {
      // Handle email submission
      alert(`Thank you! We'll be in touch at ${email}`)
      setEmail('')
    }
  }

  if (step === 'landing') {
    return (
      <div className="landing-page">
        <nav className="nav">
          <div className="nav-content">
            <img src="/white-logo.png" alt="Aallie" className="logo-img" />
            <button className="nav-button" onClick={() => setStep('input')}>
              Try Now
            </button>
          </div>
        </nav>

        <section className="hero">
          <div className="hero-container">
            <div className="hero-main">
              <div className="hero-badge">
                <Sparkles size={16} />
                <span>AI-Powered Customer Support</span>
              </div>
              
              <h1 className="hero-title">
                Build Your AI Chatbot in
                <span className="gradient-text"> Minutes, Not Months</span>
              </h1>
              
              <p className="hero-subtitle">
                Train intelligent chatbots on your content instantly. Connect with customers 24/7, 
                answer questions automatically, and scale your support without hiring more staff.
              </p>

              <div className="hero-cta-group">
                <button className="cta-button primary" onClick={() => setStep('input')}>
                  <Zap size={20} style={{ marginRight: '0.5rem' }} />
                  Start Free Trial
                </button>
              </div>

              <div className="hero-trust">
                <div className="trust-item">
                  <CheckCircle size={18} />
                  <span>No Credit Card Required</span>
                </div>
                <div className="trust-item">
                  <CheckCircle size={18} />
                  <span>Setup in 5 Minutes</span>
                </div>
                <div className="trust-item">
                  <CheckCircle size={18} />
                  <span>24/7 Support</span>
                </div>
              </div>
            </div>

            <div className="hero-visual">
              <div className="hero-stats">
                <div className="stat-card">
                  <div className="stat-number">10x</div>
                  <div className="stat-label">Faster Response</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">24/7</div>
                  <div className="stat-label">Always Available</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">95%</div>
                  <div className="stat-label">Accuracy Rate</div>
                </div>
              </div>

              <div className="hero-preview">
                <div className="preview-card">
                  <div className="preview-header">
                    <div className="preview-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <div className="preview-title">AI Assistant</div>
                  </div>
                  <div className="preview-content">
                    <div className="preview-message bot">
                      <p>Hi! I'm your AI assistant. How can I help you today?</p>
                    </div>
                    <div className="preview-message user">
                      <p>Tell me about your services</p>
                    </div>
                    <div className="preview-message bot typing">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-features-preview">
            <div className="feature-preview-item">
              <Globe size={24} />
              <span>Website Integration</span>
            </div>
            <div className="feature-preview-item">
              <FileText size={24} />
              <span>PDF & Documents</span>
            </div>
            <div className="feature-preview-item">
              <Smartphone size={24} />
              <span>Social Media</span>
            </div>
            <div className="feature-preview-item">
              <Zap size={24} />
              <span>Instant Setup</span>
            </div>
          </div>
        </section>

        <section className="features">
          <div className="features-container">
            <div className="features-header">
              <div className="features-badge">
                <Sparkles size={18} />
                <span>Powerful Features</span>
              </div>
              <h2 className="features-title">Everything You Need to Build Your AI Chatbot</h2>
              <p className="features-description">
                Connect multiple sources, train instantly, and deploy your intelligent chatbot in minutes
              </p>
            </div>
            
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-card-inner">
                  <div className="feature-icon-wrapper">
                    <div className="feature-icon">
                      <Globe size={40} />
                    </div>
                    <div className="feature-icon-bg"></div>
                  </div>
                  <div className="feature-content">
                    <h3>Website Integration</h3>
                    <p>Train your chatbot on your website content instantly. Just paste your URL and we'll handle the rest.</p>
                    <div className="feature-highlight">
                      <Zap size={14} />
                      <span>Instant Sync</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="feature-card">
                <div className="feature-card-inner">
                  <div className="feature-icon-wrapper">
                    <div className="feature-icon">
                      <FileText size={40} />
                    </div>
                    <div className="feature-icon-bg"></div>
                  </div>
                  <div className="feature-content">
                    <h3>PDF & Documents</h3>
                    <p>Upload PDFs, Word docs, or Google Docs. Our AI extracts knowledge automatically with high accuracy.</p>
                    <div className="feature-highlight">
                      <Zap size={14} />
                      <span>Smart Extraction</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="feature-card">
                <div className="feature-card-inner">
                  <div className="feature-icon-wrapper">
                    <div className="feature-icon">
                      <Smartphone size={40} />
                    </div>
                    <div className="feature-icon-bg"></div>
                  </div>
                  <div className="feature-content">
                    <h3>Social Media</h3>
                    <p>Connect Instagram, LinkedIn, Facebook, and TikTok to train your bot on your social content.</p>
                    <div className="feature-highlight">
                      <Zap size={14} />
                      <span>Multi-Platform</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="feature-card">
                <div className="feature-card-inner">
                  <div className="feature-icon-wrapper">
                    <div className="feature-icon">
                      <Zap size={40} />
                    </div>
                    <div className="feature-icon-bg"></div>
                  </div>
                  <div className="feature-content">
                    <h3>Instant Setup</h3>
                    <p>Get started in minutes, no coding required. Your chatbot is ready to use immediately after training.</p>
                    <div className="feature-highlight">
                      <Zap size={14} />
                      <span>5-Minute Setup</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="how-it-works">
          <div className="how-it-works-container">
            <div className="how-it-works-header">
              <div className="how-it-works-badge">
                <Sparkles size={18} />
                <span>Simple Process</span>
              </div>
              <h2 className="how-it-works-title">Get Started in 3 Simple Steps</h2>
              <p className="how-it-works-description">
                From connecting your content to chatting with your AI assistant - it's that simple
              </p>
            </div>
            
            <div className="steps">
              <div className="step-card">
                <div className="step-card-inner">
                  <div className="step-icon-wrapper">
                    <div className="step-icon">
                      <Upload size={40} />
                    </div>
                    <div className="step-icon-bg"></div>
                    <div className="step-number">1</div>
                  </div>
                  <div className="step-content">
                    <h3>Connect Your Knowledge Base</h3>
                    <p>Link your website, upload PDFs, or connect social media profiles. We support multiple sources to train your chatbot.</p>
                    <div className="step-highlight">
                      <Link2 size={14} />
                      <span>Multiple Sources</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="step-connector">
                <ArrowRight size={24} />
              </div>
              
              <div className="step-card">
                <div className="step-card-inner">
                  <div className="step-icon-wrapper">
                    <div className="step-icon">
                      <Brain size={40} />
                    </div>
                    <div className="step-icon-bg"></div>
                    <div className="step-number">2</div>
                  </div>
                  <div className="step-content">
                    <h3>AI Training</h3>
                    <p>Our advanced AI processes your content automatically, extracts key information, and builds a comprehensive knowledge base.</p>
                    <div className="step-highlight">
                      <Zap size={14} />
                      <span>Automatic Processing</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="step-connector">
                <ArrowRight size={24} />
              </div>
              
              <div className="step-card">
                <div className="step-card-inner">
                  <div className="step-icon-wrapper">
                    <div className="step-icon">
                      <MessageCircle size={40} />
                    </div>
                    <div className="step-icon-bg"></div>
                    <div className="step-number">3</div>
                  </div>
                  <div className="step-content">
                    <h3>Start Chatting</h3>
                    <p>Your chatbot is ready! Start chatting and see it answer questions instantly with accurate, context-aware responses.</p>
                    <div className="step-highlight">
                      <MessageCircle size={14} />
                      <span>Instant Responses</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  if (step === 'input') {
    return (
      <div className="input-page">
        <nav className="nav">
          <div className="nav-content">
            <img src="/white-logo.png" alt="Aallie" className="logo-img" />
            <button className="nav-button" onClick={() => setStep('landing')}>
              Back
            </button>
          </div>
        </nav>

        <div className="input-container">
          <h2 className="input-title">Connect Your Knowledge Base</h2>
          <p className="input-subtitle">Choose how you'd like to train your chatbot</p>

          <div className="source-options">
            <button 
              className={`source-card ${knowledgeSource === 'link' ? 'active' : ''}`}
              onClick={() => handleSourceSelect('link')}
            >
              <div className="source-icon">
                <Link2 size={40} />
              </div>
              <h3>Website Link</h3>
              <p>Enter a URL to scrape content</p>
            </button>

            <button 
              className={`source-card ${knowledgeSource === 'pdf' ? 'active' : ''}`}
              onClick={() => handleSourceSelect('pdf')}
            >
              <div className="source-icon">
                <FileUp size={40} />
              </div>
              <h3>PDF or Google Doc</h3>
              <p>Upload a PDF or Google Doc document</p>
            </button>

            <button 
              className={`source-card ${knowledgeSource === 'instagram' ? 'active' : ''}`}
              onClick={() => handleSourceSelect('instagram')}
            >
              <div className="source-icon">
                <Instagram size={40} />
              </div>
              <h3>Instagram</h3>
              <p>Connect your Instagram profile</p>
            </button>

            <button 
              className={`source-card ${knowledgeSource === 'linkedin' ? 'active' : ''}`}
              onClick={() => handleSourceSelect('linkedin')}
            >
              <div className="source-icon">
                <Linkedin size={40} />
              </div>
              <h3>LinkedIn</h3>
              <p>Connect your LinkedIn profile</p>
            </button>

            <button 
              className={`source-card ${knowledgeSource === 'facebook' ? 'active' : ''}`}
              onClick={() => handleSourceSelect('facebook')}
            >
              <div className="source-icon">
                <Facebook size={40} />
              </div>
              <h3>Facebook</h3>
              <p>Connect your Facebook profile</p>
            </button>

            <button 
              className={`source-card ${knowledgeSource === 'tiktok' ? 'active' : ''}`}
              onClick={() => handleSourceSelect('tiktok')}
            >
              <div className="source-icon">
                <Music size={40} />
              </div>
              <h3>TikTok</h3>
              <p>Connect your TikTok profile</p>
            </button>
          </div>

          {knowledgeSource && (
            <div className="input-form">
              {knowledgeSource === 'link' && (
                <div className="form-group">
                  <label>Enter Website URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="form-input"
                  />
                </div>
              )}

              {knowledgeSource === 'pdf' && (
                <div className="form-group">
                  <label>Upload PDF or Google Doc File</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        // Validate file type
                        const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
                        const validExtensions = ['.pdf', '.doc', '.docx']
                        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
                        
                        if (validExtensions.includes(fileExtension) || validTypes.includes(file.type)) {
                          setPdfFile(file)
                          setInputValue(file.name)
                        } else {
                          setError('Please upload a PDF (.pdf) or Google Doc (.doc, .docx) file')
                        }
                      }
                    }}
                    className="form-input file-input"
                  />
                  <p className="form-hint">Supported formats: PDF (.pdf), Word Document (.doc, .docx)</p>
                </div>
              )}

              {knowledgeSource === 'instagram' && (
                <div className="form-group">
                  <label>Instagram Username or Profile URL</label>
                  <input
                    type="text"
                    placeholder="@username or https://instagram.com/username"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="form-input"
                  />
                </div>
              )}

              {knowledgeSource === 'linkedin' && (
                <div className="form-group">
                  <label>LinkedIn Profile URL</label>
                  <input
                    type="url"
                    placeholder="https://linkedin.com/in/username"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="form-input"
                  />
                </div>
              )}

              {knowledgeSource === 'facebook' && (
                <div className="form-group">
                  <label>Facebook Profile URL or Username</label>
                  <input
                    type="text"
                    placeholder="https://facebook.com/username or @username"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="form-input"
                  />
                </div>
              )}

              {knowledgeSource === 'tiktok' && (
                <div className="form-group">
                  <label>TikTok Username or Profile URL</label>
                  <input
                    type="text"
                    placeholder="@username or https://tiktok.com/@username"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="form-input"
                  />
                </div>
              )}

              <button 
                className="submit-button"
                onClick={handleSubmitKnowledge}
                disabled={(!inputValue.trim() && !pdfFile) || isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Start Training Chatbot'}
              </button>
              
            {error && (
              <div className="error-message">
                <AlertCircle size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '0.5rem' }} />
                {error}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    )
  }

  if (step === 'chat') {
    return (
      <div className="chat-page">
        <nav className="nav">
          <div className="nav-content">
            <img src="/white-logo.png" alt="Aallie" className="logo-img" />
            <button className="nav-button" onClick={() => setStep('landing')}>
              Home
            </button>
          </div>
        </nav>

        <div className="chat-container">
          <div className="chat-header">
            <h2>Chat with Your AI Assistant</h2>
            <p>Ask me anything about the knowledge base I've been trained on!</p>
          </div>

          <div className="chat-messages">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.sender}`}>
                <div className="message-content">
                  {message.sender === 'bot' ? (
                    <ReactMarkdown
                      components={{
                        p: ({ node, ...props }) => <p className="markdown-p" {...props} />,
                        ul: ({ node, ...props }) => <ul className="markdown-ul" {...props} />,
                        ol: ({ node, ...props }) => <ol className="markdown-ol" {...props} />,
                        li: ({ node, ...props }) => <li className="markdown-li" {...props} />,
                        strong: ({ node, ...props }) => <strong className="markdown-strong" {...props} />,
                        em: ({ node, ...props }) => <em className="markdown-em" {...props} />,
                        h1: ({ node, ...props }) => <h1 className="markdown-h1" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="markdown-h2" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="markdown-h3" {...props} />,
                        code: ({ node, ...props }) => <code className="markdown-code" {...props} />,
                        pre: ({ node, ...props }) => <pre className="markdown-pre" {...props} />,
                      }}
                    >
                      {message.text}
                    </ReactMarkdown>
                  ) : (
                    <span>{message.text}</span>
                  )}
                </div>
                <div className="message-time">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="message bot">
                <div className="message-content typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            {error && (
              <div className="error-message">
                <AlertCircle size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '0.5rem' }} />
                {error}
              </div>
            )}
          </div>

          <div className="chat-input-container">
            {(() => {
              const userMessageCount = messages.filter(m => m.sender === 'user').length
              const isLimitReached = userMessageCount >= 3
              
              if (isLimitReached) {
                return (
                  <div className="message-limit-reached">
                    <p>You've reached the message limit. Please contact us to continue the conversation!</p>
                    <button 
                      className="conversion-button-inline"
                      onClick={() => setStep('conversion')}
                    >
                      Get Started
                    </button>
                  </div>
                )
              }

  return (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const input = e.currentTarget.querySelector('input') as HTMLInputElement
                    if (input.value.trim()) {
                      handleSendMessage(input.value)
                      input.value = ''
                    }
                  }}
                  className="chat-input-form"
                >
                  <input
                    type="text"
                    placeholder={`Type your message... (${3 - userMessageCount} messages remaining)`}
                    className="chat-input"
                    disabled={isProcessing}
                  />
                  <button type="submit" className="send-button" disabled={isProcessing}>
                    Send
                  </button>
                </form>
              )
            })()}
          </div>
        </div>
      </div>
    )
  }

  if (step === 'conversion') {
    return (
      <div className="conversion-page">
        <nav className="nav">
          <div className="nav-content">
            <img src="/white-logo.png" alt="Aallie" className="logo-img" />
          </div>
        </nav>

        <div className="conversion-container">
          <div className="conversion-content">
            <div className="success-icon">
              <Sparkles size={64} />
            </div>
            <h2 className="conversion-title">Loved the Experience?</h2>
            <p className="conversion-subtitle">
              Ready to create your own AI chatbot? Let's get you set up!
            </p>

            <div className="conversion-options">
              <button className="conversion-button primary" onClick={handleBookCall}>
                <Calendar size={20} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                Book a Free Call
              </button>
              <button 
                className="conversion-button secondary"
                onClick={() => setShowEmailForm(!showEmailForm)}
              >
                <Mail size={20} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                Get Started via Email
              </button>
            </div>

            {showEmailForm && (
              <form onSubmit={handleEmailSubmit} className="email-form">
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="email-input"
                  required
                />
                <button type="submit" className="email-submit-button">
                  Submit
        </button>
              </form>
            )}

            <div className="conversion-benefits">
              <h3>What You'll Get:</h3>
              <ul>
                <li>
                  <CheckCircle size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '0.5rem' }} />
                  Custom AI chatbot trained on your content
                </li>
                <li>
                  <CheckCircle size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '0.5rem' }} />
                  24/7 customer support automation
                </li>
                <li>
                  <CheckCircle size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '0.5rem' }} />
                  Easy integration with your website
                </li>
                <li>
                  <CheckCircle size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '0.5rem' }} />
                  Analytics and insights dashboard
                </li>
                <li>
                  <CheckCircle size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '0.5rem' }} />
                  Ongoing support and updates
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
  )
  }

  return null
}

export default App
