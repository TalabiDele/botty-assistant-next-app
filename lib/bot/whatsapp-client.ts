import { Client, LocalAuth, Message } from 'whatsapp-web.js'
import * as schedule from 'node-schedule'
import { Reminder, ChatInfo, BotStatus } from '@/lib/types'

class WhatsAppBot {
	private static instance: WhatsAppBot
	private client: Client | null = null
	private qrCode: string | null = null
	private isReady: boolean = false
	private reminders: Map<number, Reminder> = new Map()
	private jobs: Map<number, any> = new Map()
	private reminderIdCounter: number = 1
	private messageHandlers: Array<(message: Message) => void> = []
	private initialized = false

	private constructor() {}

	static getInstance(): WhatsAppBot {
		if (!WhatsAppBot.instance) {
			WhatsAppBot.instance = new WhatsAppBot()
		}
		return WhatsAppBot.instance
	}

	async initialize(): Promise<void> {
		if (this.initialized) {
			console.log('Bot already initialized')
			return
		}

		this.client = new Client({
			authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
			puppeteer: {
				headless: true,
				args: [
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--disable-dev-shm-usage',
					'--disable-gpu',
				],
			},
		})

		this.setupEventHandlers()
		await this.client.initialize()
		this.initialized = true // ✅ mark as initialized
	}

	private setupEventHandlers(): void {
		if (!this.client) return

		this.client.on('qr', (qr: string) => {
			console.log('QR Code received')
			this.qrCode = qr
		})

		this.client.on('ready', () => {
			console.log('WhatsApp client is ready!')
			this.isReady = true
			this.qrCode = null
		})

		this.client.on('authenticated', () => {
			console.log('Client authenticated')
		})

		this.client.on('auth_failure', (msg: string) => {
			console.error('Authentication failed:', msg)
		})

		this.client.on('disconnected', (reason: string) => {
			console.log('Client disconnected:', reason)
			this.isReady = false
		})

		// ✅ This triggers when *you* send messages (from the logged-in account)
		this.client.on('message_create', async (message: Message) => {
			if (message.fromMe) {
				console.log('You sent a command:', message.body)
				this.messageHandlers.forEach((handler) => handler(message))
			}
		})
	}

	onMessage(handler: (message: Message) => void): void {
		this.messageHandlers.push(handler)
	}

	async sendMessage(chatId: string, text: string): Promise<void> {
		console.log(chatId, text)
		if (!this.client || !this.isReady) {
			throw new Error('Client not ready')
		}
		await this.client.sendMessage(chatId, text)
	}

	async sendMessageToMultiple(chatIds: string[], text: string): Promise<void> {
		for (const chatId of chatIds) {
			try {
				await this.sendMessage(chatId, text)
				await new Promise((resolve) => setTimeout(resolve, 500))
			} catch (error) {
				console.error(`Failed to send to ${chatId}:`, error)
			}
		}
	}

	async getChats(): Promise<ChatInfo[]> {
		if (!this.client || !this.isReady) {
			throw new Error('Client not ready')
		}
		const chats = await this.client.getChats()
		return chats.map((chat: any) => ({
			id: chat.id?._serialized ?? chat.id,
			name:
				chat.name ??
				chat.formattedTitle ??
				chat.contact?.pushname ??
				(chat.id && chat.id.user) ??
				'Unknown',
			isGroup: !!chat.isGroup,
		}))
	}

	async searchChats(query: string): Promise<ChatInfo[]> {
		const chats = await this.getChats()
		return chats.filter((chat) =>
			(chat.name ?? '').toString().toLowerCase().includes(query.toLowerCase())
		)
	}

	getStatus(): BotStatus {
		return {
			isReady: this.isReady,
			qrCode: this.qrCode,
			isAuthenticated: this.isReady,
			activeReminders: this.reminders.size,
		}
	}

	createReminder(reminder: Omit<Reminder, 'id' | 'createdAt'>): Reminder {
		const id = this.reminderIdCounter++
		const newReminder = {
			...reminder,
			id,
			createdAt: new Date(),
		} as Reminder

		this.reminders.set(id, newReminder)
		return newReminder
	}

	scheduleOneTime(
		reminderId: number,
		date: Date,
		callback: () => Promise<void>
	): void {
		const job = schedule.scheduleJob(date, async () => {
			try {
				await callback()
			} catch (err) {
				console.error('Error in one-time job callback:', err)
			} finally {
				this.reminders.delete(reminderId)
				this.jobs.delete(reminderId)
			}
		})
		this.jobs.set(reminderId, job)
	}

	scheduleRecurring(
		reminderId: number,
		rule: schedule.RecurrenceRule,
		callback: () => Promise<void>
	): void {
		const job = schedule.scheduleJob(rule, async () => {
			try {
				await callback()
			} catch (err) {
				console.error('Error in recurring job callback:', err)
			}
		})
		this.jobs.set(reminderId, job)
	}

	getReminders(): Reminder[] {
		return Array.from(this.reminders.values())
	}

	getReminder(id: number): Reminder | undefined {
		return this.reminders.get(id)
	}

	cancelReminder(id: number): boolean {
		const job = this.jobs.get(id)
		if (job && typeof job.cancel === 'function') {
			job.cancel()
		}
		this.jobs.delete(id)
		return this.reminders.delete(id)
	}

	async destroy(): Promise<void> {
		this.jobs.forEach((job) => {
			if (typeof job.cancel === 'function') job.cancel()
		})
		this.jobs.clear()
		this.reminders.clear()
		if (this.client) {
			await this.client.destroy()
			this.client = null
		}
		this.isReady = false
	}
}

/* -----------------------------
   ✅ Exported Helpers for Next.js
--------------------------------*/
const botInstance = WhatsAppBot.getInstance()

export async function initializeClient() {
	await botInstance.initialize()
	return botInstance
}

export const getClientStatus = (): BotStatus => botInstance.getStatus()

export default botInstance
