export interface IReminder {
	id: number
	chatId: string
	text: string
	type: ReminderType
	createdAt: Date
	targetChats?: string[]
}

export interface IOneTimeReminder extends IReminder {
	type: 'one-time'
	scheduledDate: Date
}

export interface IRecurringReminder extends IReminder {
	type: 'recurring'
	frequency: string
	cronRule: string
}

export type ReminderType = 'one-time' | 'recurring'
export type Reminder = IOneTimeReminder | IRecurringReminder

export interface ChatInfo {
	id: string
	name: string
	isGroup: boolean
}

export interface BotStatus {
	isReady: boolean
	qrCode: string | null
	isAuthenticated: boolean
	activeReminders: number
}
