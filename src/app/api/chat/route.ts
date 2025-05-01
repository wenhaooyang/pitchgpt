import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json()
  const { message } = body

  const apiKey = process.env.OPENROUTER_API_KEY

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000', // required by OpenRouter
      'X-Title': 'PitchGPT Dev',
    },
    body: JSON.stringify({
      model: 'openai/gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are PitchGPT, a startup coach helping founders improve their accelerator applications.',
        },
        {
          role: 'user',
          content: message,
        },
      ],
    }),
  })

  const data = await response.json()
  console.log('🔍 OpenRouter raw response:', JSON.stringify(data, null, 2))
  console.log('🧪 API key:', process.env.OPENROUTER_API_KEY)
  console.log('All env keys:', Object.keys(process.env))


  const reply = data.choices?.[0]?.message?.content ?? 'Sorry, no reply was generated.'
  return NextResponse.json({ reply })
}
