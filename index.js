// 适配V3 Yunzai，将index.js移至app/index.js
import {
	currentVersion,
	isV3
} from './components/Changelog.js'
import Data from './components/Data.js'

if (!global.segment) {
	global.segment = (await import("oicq")).segment
}

export * from './apps/index.js'

let index = {
	atlas: {}
}
if (isV3) {
	Bot.logger = logger
	index = await Data.importModule('/plugins/xiaoyao-cvs-plugin/adapter', 'index.js')
}

export const atlas = index.atlas || {}

Bot.logger.info(`---------^_^---------`)
Bot.logger.info(`米游社扫码登录插件${currentVersion}初始化~`)
