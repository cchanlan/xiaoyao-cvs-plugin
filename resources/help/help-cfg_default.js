/*
* 请勿直接修改此文件，可能会导致后续更新冲突
* 如需自定义可将文件复制一份，重命名为 help-cfg.js 后编辑
* */

// 帮助配置
export const helpCfg = {
  title: "米游社扫码登录帮助",
  subTitle: "Yunzai-Bot & xiaoyao-cvs-Plugin"
};
export const helpList = [{
	"group": "绑定账号",
	"list": [{
			"icon": 88,
			"title": "#扫码登录",
			"desc": "扫码绑定米游社账号（别名：#二维码登录、#辅助登录）"
		},
		{
			"icon": 76,
			"title": "#ck查询",
			"desc": "查看已绑定的账号列表"
		},
		{
			"icon": 75,
			"title": "#我的stoken",
			"desc": "查看已绑定账号的登录凭证"
		},
		{
			"icon": 61,
			"title": "#删除stoken",
			"desc": "删除已绑定的账号，可跟 uid 指定"
		},
	]
},{
	"group": "插件",
	"list": [{
			"icon": 58,
			"title": "#米游社版本",
			"desc": "查看插件更新日志"
		},
	]
}]
