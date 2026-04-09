import { getWSURL } from './config.js'

export class LogSocket {
  constructor(taskId, onData) {
    this.taskId = taskId
    this.onData = onData
    this.ws = null
    this.timer = null
    this.retries = 0
    this.maxRetries = 5
  }

  connect() {
    try {
      const url = getWSURL()
      this.ws = uni.connectSocket({ url })
      this._bind()
    } catch (e) {
      this._scheduleReconnect()
    }
  }

  _bind() {
    this.ws.onOpen(() => {
      this.retries = 0
      try {
        this.ws.send({ data: JSON.stringify({ type: 'subscribe', taskId: this.taskId }) })
      } catch (e) {}
    })
    this.ws.onMessage((evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'log' && msg.taskId === this.taskId) {
          this.onData && this.onData({ log: msg.log || '', timer: msg.timer || '' })
        }
      } catch (e) {}
    })
    this.ws.onError(() => {
      this._scheduleReconnect()
    })
    this.ws.onClose(() => {
      this._scheduleReconnect()
    })
  }

  _scheduleReconnect() {
    if (this.retries >= this.maxRetries) return
    this.retries += 1
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.connect(), 800 * this.retries)
  }

  close() {
    try {
      clearTimeout(this.timer)
      if (this.ws) this.ws.close()
    } catch (e) {}
  }
}
