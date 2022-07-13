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


