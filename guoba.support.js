import {
	Cfg
} from "./components/index.js";
/**
 *  支持锅巴
 *  锅巴插件：https://gitee.com/guoba-yunzai/guoba-plugin.git
 */

export function supportGuoba() {
  return {
    pluginInfo: {
      name: 'xiaoyao-cvs-plugin',
      title: 'xiaoyao-cvs-Plugin',
      author: '@逍遥 @cvs',
      authorLink: 'https://gitee.com/Ctrlcvs',
      link: 'https://gitee.com/Ctrlcvs/xiaoyao-cvs-plugin',
      isV3: true,
      isV2: true,
      description: '米游社扫码登录，把 stoken/ck 绑定到云崽',
      icon: 'mdi:qrcode-scan',
      iconColor: '#6bb9dd',
    },
    // 配置项信息
    configInfo: {
      schemas: [
        {
          field: 'mhy.qrcode',
          label: '扫码登录权限',
          bottomHelpMessage: '控制 #扫码登录 指令在哪些场景可用',
          component: 'Select',
          componentProps: {
            options: [
              { label: '仅群聊可用', value: 1 },
              { label: '仅私聊可用', value: 2 },
              { label: '关闭扫码登录', value: 3 },
            ],
            placeholder: '请选择扫码登录权限',
          },
        },
      ],
      // 获取配置数据方法（用于前端填充显示数据）
      getConfigData() {
        return Cfg.merged()
      },
      // 设置配置的方法（前端点确定后调用的方法）
      setConfigData(data, { Result }) {
        for (let [keyPath, value] of Object.entries(data)) {
          Cfg.set(keyPath, value)
        }
        return Result.ok({}, '保存成功~')
      },
    },
  }
}
