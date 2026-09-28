/*
* 请勿直接修改此文件，可能会导致后续更新冲突
* 如需自定义可将文件复制一份，重命名为 help-cfg.js 后编辑
* */

// 帮助配置
export const helpCfg = {
  title: "米游社帮助",  // 帮助标题
  subTitle: "Yunzai-Bot & xiaoyao-cvs-Plugin" // 帮助副标题
};
export const helpList = [{
	"group": "账号绑定",
	"list": [{
			"icon": 61,
			"title": "#扫码登录",
			"desc": "扫码绑定米游社账号（别名：#二维码登录、#辅助登录）"
		},
		{
			"icon": 66,
			"title": "#ck查询",
			"desc": "查看已绑定的账号列表"
		},
		{
			"icon": 71,
			"title": "#我的stoken",
			"desc": "查看已绑定账号的登录凭证（需私聊）"
		},
		{
			"icon": 74,
			"title": "#删除stoken",
			"desc": "删除已绑定的账号，可跟 uid 指定"
		},
	]
},{
	"group": "凭证维护",
	"list": [{
			"icon": 75,
			"title": "#刷新ck",
			"desc": "用已绑定的 stoken 重新换出 ck（别名：#获取ck、#更新ck）"
		},
		{
			"icon": 57,
			"title": "stoken=...",
			"desc": "私聊直接发送 stoken 串即可手动绑定"
		},
	]
},{
	"group": "抽卡记录",
	"list": [{
			"icon": 92,
			"title": "#更新抽卡记录",
			"desc": "更新原神抽卡记录（别名：#获取抽卡记录、#导出抽卡记录）"
		},
	]
},{
	"group": "其他",
	"list": [{
			"icon": 77,
			"title": "#米游社版本",
			"desc": "查看插件更新日志"
		},
		{
			"icon": 78,
			"title": "#米游社帮助",
			"desc": "查看本帮助"
		},
	]
}]
