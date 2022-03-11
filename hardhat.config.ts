import 'dotenv/config';
import { task, types } from "hardhat/config";
import { HardhatUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-waffle";
import '@typechain/hardhat';
import 'hardhat-dependency-compiler';
import "hardhat-spdx-license-identifier";
import "hardhat-preprocessor";
import { removeConsoleLog } from 'hardhat-preprocessor';
import "hardhat-log-remover";
import "solidity-coverage";
import "@nomiclabs/hardhat-solhint";
// import "hardhat-gas-reporter";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import {
  hashBytecodeWithoutMetadata,
  Manifest,
} from "@openzeppelin/upgrades-core";
import "hardhat-abi-exporter";

let mnemonic = process.env.MNEMONIC;
if (!mnemonic) {
  // FOR DEV ONLY, SET IT IN .env files if you want to keep it private
  // (IT IS IMPORTANT TO HAVE A NON RANDOM MNEMONIC SO THAT SCRIPTS CAN ACT ON THE SAME ACCOUNTS)
  mnemonic = 'test test test test test test test test test test test junk';
}
const accounts = { mnemonic };
console.log("Using MNEMONIC: " + mnemonic);
task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) {
    console.log(await account.address);
  }
});

task("wpaw:deploy", "Deploy wPAW")
	.setAction(async (args, hre) => {
		const accounts = await hre.ethers.getSigners();
		console.info(`Deploying wPAW with owner "${accounts[0].address}"`)

		// deploy upgradeable contract
		const WPAWToken = await hre.ethers.getContractFactory("WPAWToken");
		const wpaw = await hre.upgrades.deployProxy(WPAWToken);
		await wpaw.deployed();
		console.log(`wPAW proxy deployed at: "${wpaw.address}"`);

		// peer into OpenZeppelin manifest to extract the implementation address
		const ozUpgradesManifestClient = await Manifest.forNetwork(hre.network.provider);
		const manifest = await ozUpgradesManifestClient.read();
		const bytecodeHash = hashBytecodeWithoutMetadata(WPAWToken.bytecode);
		const implementationContract = manifest.impls[bytecodeHash];

		// verify implementation contract
		if (implementationContract) {
			console.log(`wPAW impl deployed at: "${implementationContract.address}"`);
			await hre.run("verify:verify", {
				address: implementationContract.address
			});
		}
	});

task("wpaw:verify", "Verify wPAW source code on blockchain explorer")
	.setAction(async (args, hre) => {
		const WPAWToken = await hre.ethers.getContractFactory("WPAWToken");

		// peer into OpenZeppelin manifest to extract the implementation address
		const ozUpgradesManifestClient = await Manifest.forNetwork(hre.network.provider);
		const manifest = await ozUpgradesManifestClient.read();
		const bytecodeHash = hashBytecodeWithoutMetadata(WPAWToken.bytecode);
		const implementationContract = manifest.impls[bytecodeHash];

		// verify implementation contract
		if (implementationContract) {
			console.log(`wPAW impl deployed at: "${implementationContract.address}"`);
			await hre.run("verify:verify", {
				address: implementationContract.address
			});
		}
	});

task("wpaw:upgrade", "Upgrade wPAW")
	.addParam("contract", "The smart-contract address", '', types.string)
	.setAction(async (args, hre) => {
		const accounts = await hre.ethers.getSigners();
		console.info(`Upgrading wPAW from owner "${accounts[0].address}"`)

		// deploy upgradeable contract
		const WPAWToken = await hre.ethers.getContractFactory("WPAWToken");
		const wpaw = WPAWToken.attach(args.contract);
		await hre.upgrades.upgradeProxy(wpaw, WPAWToken);

		// peer into OpenZeppelin manifest to extract the implementation address
		const ozUpgradesManifestClient = await Manifest.forNetwork(hre.network.provider);
		const manifest = await ozUpgradesManifestClient.read();
		const bytecodeHash = hashBytecodeWithoutMetadata(WPAWToken.bytecode);
		const implementationContract = manifest.impls[bytecodeHash];

		// verify implementation contract
		if (implementationContract) {
			console.log(`wPAW impl deployed at: "${implementationContract.address}"`);
			await hre.run("verify:verify", {
				address: implementationContract.address
			});
		}
	});

task("wpaw:pause", "Pause wPAW -- [EMERGENCY ONLY]")
	.addParam("wpaw", "The address of wPAW smart-contract", '', types.string)
	.setAction(async (args, hre) => {
		const wpawAddress = args.wpaw;
		const wpaw = await hre.ethers.getContractAt("WPAWToken", wpawAddress)
		await wpaw.pause()
	});

task("benis:deploy", "Deploy Benis")
	.addParam("wpaw", "The address of wPAW smart-contract", '', types.string)
	.addParam("rewards", "The number of wPAW to reward per second", 1, types.float)
	.addParam("starttime", "The timestamp at which Benis farms should start", 0, types.int)
	.setAction(async (args, hre) => {
		const wpawAddress = args.wpaw;
		const rewardsPerSecond = hre.ethers.utils.parseEther(args.rewards.toString());
		let rewardsStartTime = args.starttime == 0 ? (await hre.ethers.provider.getBlock('latest')).timestamp : args.starttime;
		const Benis = await hre.ethers.getContractFactory("Benis");
		const benis = await Benis.deploy(wpawAddress, rewardsPerSecond, rewardsStartTime);
		await benis.deployed();
		await hre.run("verify:verify", {
			address: benis.address,
			constructorArguments: [
				wpawAddress,
				rewardsPerSecond,
				rewardsStartTime
			]
		});
		console.log(`Benis deployed and verified at "${benis.address}" with rewardsPerSecond ${rewardsPerSecond.toString()} and startTime ${rewardsStartTime}`);
	});

task("benis:verify", "Verify Benis source code on blockchain explorer")
	.addParam("benis", "The address of Benis smart-contract", '', types.string)
	.addParam("wpaw", "The address of wPAW smart-contract", '', types.string)
	.addParam("rewards", "The number of wPAW to reward per second", 1, types.float)
	.addParam("starttime", "The timestamp at which Benis farms should start", 0, types.int)
	.setAction(async (args, hre) => {
		const benisAddress = args.benis;
		const rewardsPerSecond = hre.ethers.utils.parseEther(args.rewards.toString());
		let rewardsStartTime = args.starttime == 0 ? (await hre.ethers.provider.getBlock('latest')).timestamp : args.starttime;
		console.log(`Benis deployed at: "${benisAddress}"`);
		await hre.run("verify:verify", {
			address: benisAddress,
  		constructorArguments: [
				args.wpaw,
				rewardsPerSecond,
				rewardsStartTime
			]
		});
	});

task("benis:add-time", "Deploy Benis")
	.addParam("benis", "The address of Benis smart-contract", '', types.string)
	.addParam("time", "Number of seconds to extends Benis end time to", 1, types.int)
	.setAction(async (args, hre) => {
		const benisAddress = args.benis;
		const additionalTime = args.time;
		const benis = await hre.ethers.getContractAt("Benis", benisAddress)
		await benis.changeEndTime(additionalTime)
	});

task("benis:change-rewards", "Changes Benis rewards per second")
	.addParam("benis", "The address of Benis smart-contract", '', types.string)
	.addParam("rewards", "The number of wPAW to reward per second", 1, types.float)
	.setAction(async (args, hre) => {
		const benisAddress = args.benis;
		const rewardsPerSecond = hre.ethers.utils.parseEther(args.rewards.toString());
		console.log(`Rewards per second: ${hre.ethers.utils.formatEther(rewardsPerSecond)}`);
		const benis = await hre.ethers.getContractAt("Benis", benisAddress);
		await benis.setWPAWPerSecond(rewardsPerSecond, true);
	});

task("benis:alloc-pool", "Change allocation points")
	.addParam("benis", "The address of Benis smart-contract", '', types.string)
	.addParam("pid", "The pool ID", 0, types.int)
	.addParam("alloc", "Number of seconds to extends Benis end time to", 1, types.int)
	.setAction(async (args, hre) => {
		const benisAddress = args.benis;
		const pid = args.pid;
		const alloc = args.alloc;
		const benis = await hre.ethers.getContractAt("Benis", benisAddress);
		await benis.set(pid, alloc, true, { gasLimit: 300_000 });
	});

task("benis:create-pool", "Create a farm")
	.addParam("benis", "The address of Benis smart-contract", '', types.string)
	.addParam("lp", "The address of the LP token or wPAW", '', types.string)
	.addParam("alloc", "The allocation points for this pool", 1000, types.int)
	.setAction(async (args, hre) => {
		const benisAddress = args.benis;
		const lpTokenAddress = args.lp;
		const alloc = args.alloc;
		const benis = await hre.ethers.getContractAt("Benis", benisAddress)
		await benis.add(alloc, lpTokenAddress, true);
	});

const config: HardhatUserConfig = {
	solidity: {
		compilers: [
			{
				version: "0.8.4",
				settings: {
					metadata: {
						bytecodeHash: "none"
					},
					optimizer: {
						enabled: true,
						runs: 5000
					},
					outputSelection: {
						"*": {
							"*": ["metadata"]
						}
					}
				},
			},
			{
				version: "0.6.12",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200
					},
				}
			},
			{
				version: "0.5.16",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200
					},
				}
			}
		],
		overrides: {
			"@pancakeswap/pancake-swap-lib/contracts/math/SafeMath.sol": {
				version: "0.6.12"
			},
			"@pancakeswap/pancake-swap-lib/contracts/token/BEP20/IBEP20.sol": {
				version: "0.6.12"
			},
			"@pancakeswap/pancake-swap-lib/contracts/token/BEP20/SafeBEP20.sol": {
				version: "0.6.12"
			},
			"@pancakeswap/pancake-swap-lib/contracts/access/Ownable.sol": {
				version: "0.6.12"
			},
			"@pancakeswap/pancake-swap-lib/contracts/utils/Address.sol": {
				version: "0.6.12"
			},
			"@pancakeswap/pancake-swap-lib/contracts/GSN/Context.sol": {
				version: "0.6.12"
			}
		}
	},
  networks: {
		hardhat: {
			accounts
		},
		/*
		hardhat: {
			chainId: 123,
			throwOnCallFailures: false
		},
		*/
		localhost: {
			url: 'http://localhost:8545',
			accounts,
		},
		rinkeby: {
			gasMultiplier: 2,
			accounts,
			url: "https://rinkeby.infura.io/v3/2b0e677e7a214cc9855fa34e2e1f682e"
		},
		bscdevnet: {
			url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
			accounts,
			chainId: 97,
		},
		bsctestnet: {
			url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
			accounts,
			chainId: 97,
		},
		bsc: {
			url: 'https://bsc-dataseed.binance.org/',
			accounts,
			chainId: 56,
		},
		/*
		polygontestnet: {
			url: 'https://rpc-mumbai.maticvigil.com',
			accounts,
			chainId: 80001,
		},
		*/
		polygontestnet: {
			url: 'https://rpc-mumbai.maticvigil.com',
			accounts,
			chainId: 80001,
			gasMultiplier: 1.1,
			gasPrice: 45000000000,
		},
		polygon: {
			url: 'https://polygon-rpc.com',
			accounts,
			chainId: 137,
			gasMultiplier: 1.1,
			gasPrice: 60000000000,
		},
		fantomtestnet: {
			url: 'https://rpc.testnet.fantom.network',
			accounts,
			chainId: 4002,
		},
		fantom: {
			url: 'https://rpc.ftm.tools',
			accounts,
			chainId: 250,
			gasMultiplier: 1.4,
			//gasPrice: 4000000000000,
		},
	},
	typechain: {
		outDir: 'artifacts/typechain',
		target: 'ethers-v5',
	},
	dependencyCompiler: {
		paths: [
			'@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol',
			'AnimalSwap-Treat-Farm/contracts/libs/MockBEP20.sol',
			'AnimalSwap-Core-Contracts/contracts/AnimalFactory.sol',
		],
	},
	spdxLicenseIdentifier: {
		overwrite: true,
		runOnCompile: true,
	},
	preprocess: {
		eachLine: removeConsoleLog((bre) => bre.network.name !== 'hardhat' && bre.network.name !== 'localhost'),
	},
	/*
	gasReporter: {
		currency: 'EUR',
		gasPrice: 20, // in gwei
		// coinmarketcap: ,
	},
	*/
	etherscan: {
		// Your API key for Etherscan
		// Obtain one at https://etherscan.io/
		apiKey: process.env.ETHERSCAN_API_KEY
	},
	abiExporter: {
		path: './abi',
		clear: true,
		flat: true,
		// only: ['WPAWToken', 'Benis'],
		spacing: 2
	}
};

export default config;
