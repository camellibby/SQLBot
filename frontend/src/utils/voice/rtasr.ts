import CryptoJS from 'crypto-js'

const RTASR_URL = 'wss://rtasr.xfyun.cn/v1/ws'

export interface RtasrConfig {
  appId: string
  apiKey: string
}

export function getWebSocketUrl(config: RtasrConfig) {
  const { appId, apiKey } = config
  const ts = Math.floor(new Date().getTime() / 1000)
  const signa = CryptoJS.MD5(appId + ts).toString()
  const signatureSha = CryptoJS.HmacSHA1(signa, apiKey)
  const signature = CryptoJS.enc.Base64.stringify(signatureSha)
  return `${RTASR_URL}?appid=${appId}&ts=${ts}&signa=${encodeURIComponent(signature)}`
}

export function parseResult(resultData: string): string | null {
  try {
    const jsonData = JSON.parse(resultData)
    if (jsonData.action === 'result') {
      const data = JSON.parse(jsonData.data)
      let text = ''
      let resultText = ''
      data.cn.st.rt.forEach((j: any) => {
        j.ws.forEach((k: any) => {
          k.cw.forEach((l: any) => {
            text += l.w
          })
        })
      })
      if (data.cn.st.type == 0) {
        // 【最终】识别结果：
        resultText += text
        text = ''
      }
      return resultText
    }
    return null
  } catch (error) {
    console.error('Failed to parse result:', error)
    return null
  }
}
