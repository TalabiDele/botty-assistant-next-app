// import { NextResponse } from 'next/server'
// import WhatsAppBot from '@/lib/bot/whatsapp-client'

// export async function GET() {
// 	try {
// 		const bot = WhatsAppBot.getInstance()
// 		const status = bot.getStatus()
// 		return NextResponse.json(status)
// 	} catch (error: any) {
// 		return NextResponse.json({ error: error.message }, { status: 500 })
// 	}
// }

// export const dynamic = 'force-dynamic'

// app/api/bot/status/route.ts
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic' // ensure Node runtime
export const runtime = 'nodejs' // force Node.js, not edge

export async function GET() {
	try {
		const { getClientStatus } = await import('@/lib/bot/whatsapp-client')
		const status = await getClientStatus()
		return NextResponse.json({ status })
	} catch (error: any) {
		console.error('Bot status error:', error)
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
}
