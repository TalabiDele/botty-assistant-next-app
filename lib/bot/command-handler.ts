// lib/bot/command-handler.ts
import { Message } from 'whatsapp-web.js'
import * as schedule from 'node-schedule'
import botInstance from './whatsapp-client'

export class CommandHandler {
	private bot = botInstance

	async handle(message: Message): Promise<void> {
		const text = message.body || ''
		const chatId = message.from

		if (chatId === 'status@broadcast') return

		console.log(
			`Message: "${text}" | fromMe: ${message.fromMe} | from: ${chatId}`
		)

		const onlyOwner = (process.env.ONLY_RESPOND_TO_OWNER ?? 'false') === 'true'
		console.log(onlyOwner)
		if (onlyOwner && !message.fromMe) return

		if (!text.startsWith('!')) return
		console.log(`Processing command: ${text}`)

		if (/^!help$/i.test(text)) {
			await this.handleHelp(message)
		} else if (/^!remind\s+/i.test(text)) {
			await this.handleRemind(message, chatId)
		} else if (/^!recurring\s+/i.test(text)) {
			await this.handleRecurring(message, chatId)
		} else if (/^!broadcast\s+/i.test(text)) {
			await this.handleBroadcast(message, chatId)
		} else if (/^!broadcast-once\s+/i.test(text)) {
			await this.handleBroadcastOnce(message, chatId)
		} else if (/^!list$/i.test(text)) {
			await this.handleList(message, chatId)
		} else if (/^!cancel\s+/i.test(text)) {
			await this.handleCancel(message, chatId)
		} else if (/^!chats/i.test(text)) {
			await this.handleChats(message)
		} else {
			await message.reply('🤔 Unknown command. Type *!help* for help.')
		}
	}

	private async handleHelp(message: Message): Promise<void> {
		const help = `🤖 *WhatsApp Reminder Bot*

*Personal Reminders:*
• !remind <msg> at <date/time>
• !recurring <msg> <freq> at <time>

*Broadcasts:*
• !broadcast <msg> <freq> at <time> to <chats>
• !broadcast-once <msg> at <time> to <chats>

*Management:*
• !list - View reminders
• !cancel <id> - Cancel reminder
• !chats - List chats

*Examples:*
!remind Buy milk at 2024-12-20 18:00
!recurring Standup daily at 09:00
!broadcast Good morning! daily at 08:00 to Team A, Team B
!chats`

		await message.reply(help)
	}

	private async handleRemind(message: Message, chatId: string): Promise<void> {
		const match = message.body.match(/!remind\s+(.+?)\s+at\s+(.+)/i)
		if (!match) {
			await message.reply('❌ Use: !remind <message> at <date/time>')
			return
		}

		const text = match[1].trim()
		const dateStr = match[2].trim()
		const date = new Date(dateStr)

		if (isNaN(date.getTime()) || date <= new Date()) {
			await message.reply('❌ Invalid date or date in the past')
			return
		}

		const reminder = this.bot.createReminder({
			chatId,
			text,
			type: 'one-time',
			scheduledDate: date,
		} as any)

		this.bot.scheduleOneTime(reminder.id, date, async () => {
			await this.bot.sendMessage(chatId, `🔔 *REMINDER*\n\n${text}`)
		})

		await message.reply(
			`✅ Reminder set!\n📌 ID: ${
				reminder.id
			}\n💬 ${text}\n⏰ ${date.toLocaleString()}`
		)
	}

	private async handleRecurring(
		message: Message,
		chatId: string
	): Promise<void> {
		const match = message.body.match(
			/!recurring\s+(.+?)\s+(daily|weekly|monthly|every\s+\w+)\s+at\s+(.+)/i
		)
		if (!match) {
			await message.reply('❌ Use: !recurring <message> <frequency> at <time>')
			return
		}

		const text = match[1].trim()
		const freq = match[2].trim().toLowerCase()
		const timeStr = match[3].trim()

		const rule = this.parseCronRule(freq, timeStr)
		if (!rule) {
			await message.reply('❌ Could not parse schedule')
			return
		}

		const reminder = this.bot.createReminder({
			chatId,
			text,
			type: 'recurring',
			frequency: freq,
			cronRule: JSON.stringify({ freq, time: timeStr }),
		} as any)

		this.bot.scheduleRecurring(reminder.id, rule, async () => {
			await this.bot.sendMessage(chatId, `🔔 *RECURRING REMINDER*\n\n${text}`)
		})

		await message.reply(
			`✅ Recurring reminder set!\n📌 ID: ${reminder.id}\n💬 ${text}\n🔄 ${freq}`
		)
	}

	private async handleBroadcast(
		message: Message,
		chatId: string
	): Promise<void> {
		const match = message.body.match(
			/!broadcast\s+(.+?)\s+(daily|weekly|monthly|every\s+\w+)\s+at\s+(.+?)\s+to\s+(.+)/i
		)
		if (!match) {
			await message.reply(
				'❌ Use: !broadcast <msg> <freq> at <time> to <chat1>, <chat2>'
			)
			return
		}

		const text = match[1].trim()
		const freq = match[2].trim()
		const timeStr = match[3].trim()
		const targetsStr = match[4].trim()

		const targets = targetsStr.split(',').map((t) => t.trim())
		const matchedChats = await this.findChats(targets)

		if (matchedChats.length === 0) {
			await message.reply('❌ No matching chats found')
			return
		}

		const rule = this.parseCronRule(freq, timeStr)
		if (!rule) {
			await message.reply('❌ Could not parse schedule')
			return
		}

		const chatIds = matchedChats.map((c) => c.id)
		const reminder = this.bot.createReminder({
			chatId,
			text,
			type: 'recurring',
			frequency: freq,
			cronRule: JSON.stringify({ freq, time: timeStr }),
			targetChats: chatIds,
		} as any)

		this.bot.scheduleRecurring(reminder.id, rule, async () => {
			await this.bot.sendMessageToMultiple(chatIds, `📢 *BROADCAST*\n\n${text}`)
		})

		const list = matchedChats.map((c) => `• ${c.name}`).join('\n')
		await message.reply(
			`✅ Broadcast set!\n📌 ID: ${reminder.id}\n🔄 ${freq}\n📤 Sending to:\n${list}`
		)
	}

	private async handleBroadcastOnce(
		message: Message,
		chatId: string
	): Promise<void> {
		const match = message.body.match(
			/!broadcast-once\s+(.+?)\s+at\s+(.+?)\s+to\s+(.+)/i
		)
		if (!match) {
			await message.reply(
				'❌ Use: !broadcast-once <msg> at <time> to <chat1>, <chat2>'
			)
			return
		}

		const text = match[1].trim()
		const dateStr = match[2].trim()
		const targetsStr = match[3].trim()

		const date = new Date(dateStr)
		if (isNaN(date.getTime()) || date <= new Date()) {
			await message.reply('❌ Invalid date')
			return
		}

		const targets = targetsStr.split(',').map((t) => t.trim())
		const matchedChats = await this.findChats(targets)

		if (matchedChats.length === 0) {
			await message.reply('❌ No matching chats found')
			return
		}

		const chatIds = matchedChats.map((c) => c.id)
		const reminder = this.bot.createReminder({
			chatId,
			text,
			type: 'one-time',
			scheduledDate: date,
			targetChats: chatIds,
		} as any)

		this.bot.scheduleOneTime(reminder.id, date, async () => {
			await this.bot.sendMessageToMultiple(chatIds, `📢 *BROADCAST*\n\n${text}`)
		})

		const list = matchedChats.map((c) => `• ${c.name}`).join('\n')
		await message.reply(
			`✅ Broadcast scheduled!\n📌 ID: ${
				reminder.id
			}\n⏰ ${date.toLocaleString()}\n📤 Sending to:\n${list}`
		)
	}

	private async handleList(message: Message, _chatId: string): Promise<void> {
		const reminders = this.bot.getReminders()

		if (reminders.length === 0) {
			await message.reply('📭 No active reminders')
			return
		}

		let response = '📋 *Active Reminders:*\n\n'
		reminders.forEach((r) => {
			response += `*ID ${r.id}:* ${r.text}\n`
			if (r.type === 'one-time') {
				response += `⏰ ${(r as any).scheduledDate?.toString() ?? 'N/A'}\n`
			} else {
				response += `🔄 ${(r as any).frequency ?? 'recurring'}\n`
			}
			response += '\n'
		})

		await message.reply(response)
	}

	private async handleCancel(message: Message, chatId: string): Promise<void> {
		const match = message.body.match(/!cancel\s+(\d+)/i)
		if (!match) {
			await message.reply('❌ Use: !cancel <id>')
			return
		}

		const id = parseInt(match[1], 10)
		const reminder = this.bot.getReminder(id)

		if (!reminder) {
			await message.reply('❌ Reminder not found')
			return
		}

		if (reminder.chatId !== chatId && !message.fromMe) {
			await message.reply('❌ Can only cancel your own reminders')
			return
		}

		this.bot.cancelReminder(id)
		await message.reply(`✅ Reminder #${id} cancelled`)
	}

	private async handleChats(message: Message): Promise<void> {
		const match = message.body.match(/!chats(\s+(.+))?$/i)
		const query = match?.[2]?.trim()

		const chats = query
			? await this.bot.searchChats(query)
			: await this.bot.getChats()

		if (chats.length === 0) {
			await message.reply('📭 No chats found')
			return
		}

		const groups = chats.filter((c) => c.isGroup).slice(0, 20)
		const contacts = chats.filter((c) => !c.isGroup).slice(0, 20)

		let response = '📋 *Your Chats:*\n\n'

		if (groups.length > 0) {
			response += '📁 *Groups:*\n'
			groups.forEach((c, i) => (response += `${i + 1}. ${c.name}\n`))
			response += '\n'
		}

		if (contacts.length > 0) {
			response += '👤 *Contacts:*\n'
			contacts.forEach((c, i) => (response += `${i + 1}. ${c.name}\n`))
		}

		await message.reply(response)
	}

	private async findChats(names: string[]): Promise<any[]> {
		const matched: any[] = []
		for (const name of names) {
			const results = await this.bot.searchChats(name)
			if (results.length > 0) matched.push(results[0])
		}
		return matched
	}

	private parseCronRule(
		freq: string,
		timeStr: string
	): schedule.RecurrenceRule | null {
		const timeParts = this.parseTime(timeStr)
		if (!timeParts) return null

		const { hour, minute, dayOfWeek, dayOfMonth } = timeParts
		const rule = new schedule.RecurrenceRule()

		if (freq === 'daily') {
			rule.hour = hour
			rule.minute = minute
			return rule
		}
		if (freq === 'weekly') {
			rule.dayOfWeek = dayOfWeek ?? 1
			rule.hour = hour
			rule.minute = minute
			return rule
		}
		if (freq === 'monthly') {
			rule.date = dayOfMonth ?? 1
			rule.hour = hour
			rule.minute = minute
			return rule
		}
		return null
	}

	private parseTime(timeStr: string): any {
		const dayMap: Record<string, number> = {
			sunday: 0,
			monday: 1,
			tuesday: 2,
			wednesday: 3,
			thursday: 4,
			friday: 5,
			saturday: 6,
		}

		let dayOfWeek: number | null = null
		for (const [day, num] of Object.entries(dayMap)) {
			if (timeStr.toLowerCase().includes(day)) {
				dayOfWeek = num
				break
			}
		}

		const dayOfMonthMatch =
			timeStr.match(/\bon\s+(\d{1,2})(st|nd|rd|th)?\b/i) ||
			timeStr.match(/\b(\d{1,2})(st|nd|rd|th)\b/i)
		const dayOfMonth = dayOfMonthMatch ? parseInt(dayOfMonthMatch[1], 10) : null

		const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i)
		if (!timeMatch) return null

		let hour = parseInt(timeMatch[1], 10)
		const minute = parseInt(timeMatch[2], 10)
		const ampm = timeMatch[3]

		if (ampm) {
			if (ampm.toLowerCase() === 'pm' && hour !== 12) hour += 12
			if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0
		}

		return { hour, minute, dayOfWeek, dayOfMonth }
	}
}
