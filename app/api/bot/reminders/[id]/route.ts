// import { NextResponse } from 'next/server'
// import { initializeClient } from '@/lib/bot/whatsapp-client'

// export async function DELETE(
// 	request: Request,
// 	{ params }: { params: { id: string } }
// ) {
// 	try {
// 		const bot = await initializeClient()
// 		const id = parseInt(params.id)
// 		const deleted = bot.cancelReminder(id)

// 		if (!deleted) {
// 			return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
// 		}

// 		return NextResponse.json({ success: true })
// 	} catch (error: any) {
// 		return NextResponse.json({ error: error.message }, { status: 500 })
// 	}
// }

import { NextResponse } from 'next/server'
import { initializeClient } from '@/lib/bot/whatsapp-client'

export async function DELETE(
	request: Request,
	context: { params: { id: string } }
) {
	try {
		const bot = await initializeClient()
		const id = Number(context.params.id)

		const deleted = bot.cancelReminder(id)

		if (!deleted) {
			return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
		}

		return NextResponse.json({ success: true })
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
}
