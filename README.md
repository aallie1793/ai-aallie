# AI Aallie - AI-Powered Chatbot Service

A modern landing page and chatbot service application that allows users to create AI chatbots trained on their knowledge base from websites, PDFs, Instagram, or LinkedIn.

## Features

- 🌐 **Website Integration**: Scrape and train on website content
- 📄 **PDF Processing**: Upload PDFs and extract knowledge automatically
- 📱 **Social Media**: Connect Instagram and LinkedIn profiles
- 💬 **AI Chatbot**: Interactive chatbot powered by GPT-4
- 🎨 **Modern UI**: Beautiful, responsive design with smooth animations
- 📧 **Lead Generation**: Conversion forms for booking calls and email capture

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys

Create a `.env` file in the root directory:

```bash
# Required: OpenAI API Key for GPT functionality
VITE_OPENAI_API_KEY=your_openai_api_key_here

# Optional: Zyte API Key for professional web scraping (handles JavaScript-rendered content)
VITE_ZYTE_API_KEY=your_zyte_api_key_here
# Or use VITE_ZITE_API_KEY (typo variant also supported)
```

Get your API keys from:
- [OpenAI Platform](https://platform.openai.com/api-keys) - Required for chat and content processing
- [Zyte API](https://app.zyte.com/o/875606/zyte-api/api-access) - Optional, but recommended for better web scraping

### 3. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

## How It Works

1. **Connect Knowledge Base**: Users select a source (website, PDF, Instagram, or LinkedIn) and provide the content
2. **AI Processing**: The content is scraped/extracted and processed by GPT-4 to create a knowledge base
3. **Chat Interface**: Users can interact with the chatbot that's trained on their knowledge base
4. **Conversion**: After the trial, users are prompted to book a call or provide their email

## Technical Stack

- **React 19** with TypeScript
- **Vite** for build tooling
- **OpenAI SDK** for GPT integration
- **pdfjs-dist** for PDF text extraction
- **Modern CSS** with gradients and animations

## Notes

- **Web Scraping**: The app uses Zyte API (if configured) for professional web scraping that handles JavaScript-rendered content. If Zyte API key is not set, it falls back to free CORS proxy services.
- **CORS Limitations**: Free CORS proxies may fail for some websites. Zyte API provides more reliable scraping.
- **Instagram/LinkedIn**: These require backend implementation with proper authentication. The app currently allows manual content input as a fallback.
- **API Key Security**: In production, move API calls to a backend server to keep your API keys secure.

## License

MIT
# ai-aallie
