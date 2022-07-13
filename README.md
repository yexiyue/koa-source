# koa源码学习

**koa默认就是对我们的node原生的http服务进行了封装**

## 1.目录结构

![image-20220713104612332](https://s2.loli.net/2022/07/13/knWR7tsQOiV5rje.png)

**application.js整个的应用**

**context.js代表的是上下文**

**request.js用于扩展请求的**

**response.js用于扩展响应的**

## 2.核心

**koa的核心**

1. **封装了ctx**
2. **提供了一个中间件处理流程**
3. **提供了更好的错误处理**



### 1.封装了ctx

原生的http服务会有两个参数，req和res，为了封装ctx得先分别对req和res进行扩展

context.js、request.js、response.js三个文件相辅相成

**request.js文件**

```typescript
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
```

**response.js**

```typescript
export const response:Record<any,any>={
  _body:undefined,
  get body(){
    return this._body
  },
  set body(newValue){
    this.res.statusCode=200
    /* console.log(this.res.statusCode) */
    this._body=newValue
  }
}
```

**context.js**

```typescript
//源码中koa用的过时的api，但兼容性很好
export const ctx={}

//封装一个函数
function defineGetter(target:'request'|'response',key:PropertyKey){
  Object.defineProperty(ctx,key,{
    get() {
      return this[target][key]
    },
    //默认值为false，所以改了一次后，第二次就不能改了
    configurable:true,
    //由于数据描述符默认值基本都是false，所以得手动设置为true
    enumerable:true
  })
}

function defineSetter(target:'request'|'response',key:PropertyKey){
  /* const descriptor=Object.getOwnPropertyDescriptor(ctx,key) */
  Object.defineProperty(ctx,key,{
    /* get:descriptor?.get, */
    set(v){
      this[target][key]=v
    }
  })
}
defineGetter('request','path')
defineGetter('request','query')
defineGetter('response','body')
defineSetter('response','body')
/* Object.defineProperty(ctx,'body',{
  get(){
    return this.response.body
  },
  set(v){
    this.response.body=v
  }
}) */
/* console.log(Object.getOwnPropertyDescriptor(ctx,'body')) */
//这样对象的方式比较麻烦，不易于扩展
/* export const ctx:Record<any,any>={
  get path(){//通样的谁调用指向谁，这里指向application的请求ctx
    return this.request.path
  }
} */

//尝试用proxy来做,遇到问题，this无法成功指向原型链下一层,this总是指向proxy本身
/* export const ctx=new Proxy({},{
  get(target,p,receiver){
    console.log(target)
    console.log('****',p)
    console.log('****')
  }
}) */
```

**这三个模块都应用的代理模式，通过ctx代理到response或者request**

context模块中我用的是Object.defineProperty进行代理

**object.definerProperty()**

**基本上数据描述符的默认值都为false**

**数据描述符configurable默认值为false，所以设置了一次后就不能再设置了**

**当且仅当该属性的 `configurable` 键值为 `true` 时，该属性的描述符才能够被改变，同时该属性也能从对应的对象上被删除。**



为啥不用proxy进行代理？请看下面application模块

### 2.中间件处理流程

```typescript
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
```

 **下面来简单解释下**

**首先解决以下问题**

**1.每次请求的上下文应该是一个独立的上下**

 **2.每个应用创建的时候使用的上下文应该是不同的**

**所以Application类开头和createContext方法都使用Object.create()方法创建新对象并指定原型，这样就相互关联起来了，由于原型链又有遮蔽效应所以相互影响小。**这就很妙



现在简单描述下请求过程，当请求过来，走handelRequest方法

![image-20220713113545816](https://s2.loli.net/2022/07/13/UtxbgupI54GV3Ki.png)

**然后创建一个新的上下文**

![image-20220713113654802](https://s2.loli.net/2022/07/13/Ot1VXCSmshJPni3.png)

```typescript
//使用
app.use(async(ctx)=>{
  ctx.body='123'
})
```

**我们在使用过程中会调用body，而ctx上没有就会通过原型链去查找最终找到response模块上，**

```typescript
export const response:Record<any,any>={
  _body:undefined,
  get body(){
    return this._body
  },
  set body(newValue){
    this.res.statusCode=200
    /* console.log(this.res.statusCode) */
    this._body=newValue
  }
}
```

**然后我们在response模块进行处理，我们得通过this拿到当前的调用对象ctx。关键就是this指向问题，所以用proxy代理就不行，proxy代理不能代理原型上的属性或方法。而通过描述符即Descriptor可以。**



#### 中间件

中间件是发布订阅模式的产物，我们使用多次use，通过一个数组收集起来，当请求来了再调用，为了能够处理异步返回一个大的promise进行包装

![image-20220713115106396](https://s2.loli.net/2022/07/13/MzPhtHWSl8F5bKO.png)

**通过递归将promise串在一起，这就是所谓的洋葱模型**

**注意：**

1.  **koa默认是洋葱模型调用上一个next会走下一个中间件函数**
2. **异步怎么做呢koa中所有的异步操作都要基于promise**
3.  **koa内部会将所有的中间件进行组合操作组合成了 一个大的promise只要从开头走到了结束就算完成**
4. **await和return都会等待promise执行完毕，return后面的代码不会执行**
5. **koa中的中间件必须增加await next() 或者return next ( )否则异步逻辑可能出错**



### 3.错误处理

在compose方法中，每执行都要捕获一次错误，然后在handelRequest方法中，对大的promise进行捕获错误，通过node的事件模块告诉给用户,application 类继承了node的事件类EventEmitter

```typescript
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
```

**用户用过on方法进行监听**

```typescript
app.on('error',(e)=>{
  console.log('********',e)
})
```



## 最后

以上模块只是简单实现了核心功能，其余的扩展并没有进行封装

[项目github地址](https://github.com/yexiyue/koa-source.git)    https://github.com/yexiyue/koa-source.git

个人博客：[红尘散仙 (yexiyue.github.io)](https://yexiyue.github.io/)
