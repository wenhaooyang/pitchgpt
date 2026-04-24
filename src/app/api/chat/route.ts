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
      'HTTP-Referer': 'https://pitchgpt.vercel.app',
      'X-Title': 'PitchGPT',
    },
    body: JSON.stringify({
      model: 'openai/gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are PitchGPT, a startup coach helping founders improve their accelerator applications.',
        },
        {
          role: 'user',
          content: message,
        },
      ],
    }),
  })

  const data = await response.json()
  const reply = data.choices?.[0]?.message?.content ?? 'Sorry, no reply was generated.'
  return NextResponse.json({ reply })
}
