import axios from 'axios'

type BlacklistRecord = {
	address: string
	alias: string
	type: string
}

class PawWalletsBlacklist {
	/**
	 * Check if a PAW wallet/address is blacklisted.
	 * Returns a BlacklistRecord if address is blacklisted, undefined otherwise
	 * @param pawWallet the PAW wallet address to check with the blacklist
	 */
	public static async isBlacklisted(pawWallet: string): Promise<BlacklistRecord | undefined> {
		const resp = await axios.get('https://kirby.eu.pythonanywhere.com/api/v1/resources/addresses/all')
		const blacklist = resp.data as Array<BlacklistRecord>
		const result = blacklist.find((record) => record.address === pawWallet)
		console.debug(`Blacklist check for "${pawWallet}": ${JSON.stringify(result)}`)
		return result
	}
}

export { PawWalletsBlacklist, BlacklistRecord }
