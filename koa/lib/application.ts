import http from 'http'
//用户不能直接修改下面三个对象，可以通过原型模式让他们拿到值，修改的是自身的
import { ctx } from './context'
import { request } from './request'
import { response } from './response'
import {EventEmitter} from 'events'

declare type Middleware={
  (ctx:Application['context'],next:()=>any):any
}
//获取函数参数类型元组
declare type FunctionParamsType<T extends (...args:any[])=>any>=T extends (...args:infer P)=>any?P:never

export default class Application extends EventEmitter{
  //保证每次创建应用都是独立的上下文
  public context=Object.create(ctx)
  public request=Object.create(request)
  public response=Object.create(response)
  public middlewares:Middleware[]=[]
  public use(middleware:Middleware){
    this.middlewares.push(middleware)
  }
  constructor(){
    super()
  }
  public handelRequest:http.RequestListener=(req,res)=>{
    let ctx=this.createContext(req,res)
    //先默认状态码为404
    res.statusCode=404
    //顺序不要搞错，先默认状态码，再执行用户函数才能修改状态码，搞反了就会一直404
    this.compose(ctx).then(()=>{
      let body=ctx.body
      if(body){
        res.end(body)
      }else{
        res.end('<h1>Not found</h1>')
      }
    }).catch(e=>{
      //继承自EventEmitter,触发监听的事件
      this.emit('error',e)
    })
    
  }

  public listen(...args:FunctionParamsType<http.Server['listen']> ){
    let server=http.createServer(this.handelRequest)
    server.listen(...args)
  }

  public createContext(req:http.IncomingMessage,res:http.ServerResponse):this['context']{
    //再进行一次创建对象，以当前应用的为原型，保证每个请求之间上下文独立
    let ctx=Object.create(this.context)
    let request=Object.create(this.request)
    let response=Object.create(this.response)
    //添加属性，短写的都是原生的
    ctx.request=request;//自己封装的
    ctx.request.req=ctx.req=req;//原生的
    //响应
    ctx.response=response;//自己封装的
    ctx.response.res=ctx.res=res;//原生的
    return ctx
  }
  //组合函数，把所有中间件组成一个大的promise
  public compose(ctx:typeof this.context){
    //闭包，防止多次调用next()
    let index=-1;
    //递归
    const dispatch=(i:number):Promise<any>=>{
      
      if(i<=index){
        //直接抛出错误，直接return了
        return Promise.reject('next() call multiples times')
      }
      index=i
      if(this.middlewares.length===i)return Promise.resolve()
      let middleware=this.middlewares[i]
      //执行下一个,包装成promise
      try {//捕获执行过程中的错误
        
        return Promise.resolve(middleware(ctx,()=>dispatch(i+1)))
      } catch (error) {
        return Promise.reject(error)
      }
    }
    //执行第一个
    return dispatch(0)
    //将功能组合再一起依次执行
  }
}