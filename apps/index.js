import lodash from "lodash";
import {
	versionInfo,
	help
} from "./help.js";
import {
	rule as userRule,
	delSign,
	userInfo,
	mytoken,
	updCookie,
	bindStoken,
	bindLogin_ticket,
	gclog
} from "./user.js"
import {
	rule as qrRule,
	qrCodeLogin
} from './qrLogin.js'
// #删除ck 同步钩子：以独立 plugin 类注册（靠 priority 抢在 genshin 前面），不进下面的 rule
export { DelCkSync } from './delCkSync.js'

export {
	help,
	versionInfo,
	userInfo,
	mytoken,
	delSign,
	updCookie,
	bindStoken,
	bindLogin_ticket,
	qrCodeLogin,
	gclog,
};

let rule = {
	versionInfo: {
		reg: "^#?(米游社|mys|扫码|stoken)(版本|更新日志)$",
		describe: "查看插件更新日志",
	},
	help: {
		reg: "^#?(米游社|mys|扫码|stoken)(命令|帮助|菜单|help|说明|功能|指令|使用说明)$",
		describe: "查看插件的功能",
	},
	...qrRule,
	...userRule,
};

lodash.forEach(rule, (r) => {
	r.priority = r.priority || 50;
	r.prehash = true;
	r.hashMark = true;
});

export {
	rule
};
