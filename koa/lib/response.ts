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