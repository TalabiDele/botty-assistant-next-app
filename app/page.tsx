'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface Status {
	isReady: boolean
	qrCode: string | null
	isAuthenticated: boolean
	activeReminders: number
}

interface BotStatus {
	status: Status
}

export default function Home() {
	const [status, setStatus] = useState<BotStatus>({
		status: {
			isReady: false,
			qrCode: null,
			isAuthenticated: false,
			activeReminders: 0,
		},
	})
	const [qrDataUrl, setQrDataUrl] = useState<string>('')
	const [initializing, setInitializing] = useState(false)

	// Poll status every 2 seconds
	useEffect(() => {
		const interval = setInterval(fetchStatus, 2000)
		return () => clearInterval(interval)
	}, [])

	// Convert QR code string to image
	useEffect(() => {
		if (status.status.qrCode) {
			QRCode.toDataURL(status.status.qrCode)
				.then(setQrDataUrl)
				.catch(console.error)
		} else {
			setQrDataUrl('')
		}
	}, [status.status.qrCode])

	const fetchStatus = async () => {
		try {
			const res = await fetch('/api/bot/status')
			if (!res.ok) return
			const data = await res.json()
			setStatus(data)
		} catch (error) {
			console.error('Failed to fetch status:', error)
		}
	}

	const initializeBot = async () => {
		setInitializing(true)
		try {
			const res = await fetch('/api/bot/initialize', { method: 'POST' })
			const data = await res.json()
			console.log(data)
			QRCode.toDataURL(data?.status?.qrCode)
				.then(setQrDataUrl)
				.catch(console.error)
			if (!res.ok) console.error('Init failed', await res.text())
		} catch (error) {
			console.error('Failed to initialize:', error)
		} finally {
			setInitializing(false)
			fetchStatus()
		}
	}

	return (
		<main style={{ padding: 24 }}>
			<h1>WhatsApp Reminder Bot</h1>

			<section style={{ marginTop: 16 }}>
				<h2>Status</h2>
				<p>Ready: {status.status.isReady ? '✅' : '❌'}</p>
				<p>Authenticated: {status.status.isAuthenticated ? '✅' : '❌'}</p>
				<p>Active reminders: {status.status.activeReminders}</p>

				{!status.status.isReady && (
					<div>
						<button onClick={initializeBot} disabled={initializing}>
							{initializing ? 'Initializing...' : 'Initialize Bot'}
						</button>
					</div>
				)}

				{/* Display QR code if bot is not ready/authenticated */}
				{/* {!status.isReady && qrDataUrl && ( */}
				<div style={{ marginTop: 12 }}>
					<h3>Scan this QR to authenticate WhatsApp</h3>
					<img
						src={qrDataUrl}
						alt='WhatsApp QR Code'
						width={220}
						height={220}
					/>
				</div>
				{/* )} */}
			</section>
		</main>
	)
}
