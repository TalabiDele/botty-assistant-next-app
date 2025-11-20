export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { initializeClient, getClientStatus } from '@/lib/bot/whatsapp-client'
import { CommandHandler } from '@/lib/bot/command-handler'

let commandHandler: CommandHandler | null = null

export async function POST() {
	try {
		const bot = await initializeClient()

		// If already initialized, return status instead of reinitializing
		const status = getClientStatus()
		if (status.isReady) {
			return NextResponse.json({
				success: true,
				message: 'Bot already initialized',
				status,
			})
		}

		if (!commandHandler) {
			commandHandler = new CommandHandler()
			bot.onMessage((msg) => commandHandler!.handle(msg))
		}

		console.log('WhatsApp bot initialized:', status)

		return NextResponse.json({
			success: true,
			message: 'WhatsApp bot initialized successfully',
			status,
		})
	} catch (error: any) {
		console.error('Failed to initialize bot:', error)
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		)
	}
}
