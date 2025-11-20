import { NextResponse } from 'next/server'
import WhatsAppBot, { initializeClient } from '@/lib/bot/whatsapp-client'

export async function GET() {
	try {
		const bot = await initializeClient()
		const reminders = bot.getReminders()
		return NextResponse.json({ reminders })
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
}

export const dynamic = 'force-dynamic'
