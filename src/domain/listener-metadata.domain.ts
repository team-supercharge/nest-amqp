import { ListenOptions } from '../interface';

export class ListenerMetadata<T> {
  public callback: any;
  public callbackName: string;
  public source: string;
  public options: ListenOptions<T>;
  public targetName: string;
}
