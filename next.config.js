// // ==================== next.config.js (Updated) ====================
// /** @type {import('next').NextConfig} */
// const nextConfig = {
// 	reactStrictMode: true,
// 	webpack: (config, { isServer }) => {
// 		if (isServer) {
// 			config.externals.push({
// 				puppeteer: 'commonjs puppeteer',
// 				'puppeteer-core': 'commonjs puppeteer-core',
// 				qrcode: 'commonjs qrcode',
// 				rimraf: 'commonjs rimraf',
// 				WAWebPollsVotesSchema: 'commonjs WAWebPollsVotesSchema',
// 			})
// 		}
// 		return config
// 	},
// }

// module.exports = nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
	webpack: (config, { isServer }) => {
		if (isServer) {
			config.externals = [
				...(config.externals || []),
				'puppeteer',
				'puppeteer-core',
				'rimraf',
				'whatsapp-web.js',
			]
		}
		return config
	},
	experimental: {
		serverComponentsExternalPackages: [
			'puppeteer',
			'puppeteer-core',
			'whatsapp-web.js',
		],
	},
}

module.exports = nextConfig
