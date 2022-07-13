import url from 'url'
export const request:Record<any,any>= {
  get path(){
    const {pathname}=url.parse(this.req.url)
    return pathname
  },
  get url():string{//这就是为什么在request身上加上一个req属性，为了在取值的时候可以快速获取到原生的req
    //为啥使用原型链方式，因为可以通过这很方便的拿到this，谁调用this就是谁
    return this.req.url
  },
  get query(){
    const {query}=url.parse(this.req.url,true)
    return query
  }
}