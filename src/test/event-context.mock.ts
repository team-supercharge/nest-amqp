/* istanbul ignore file */

import { EventContext } from 'rhea-promise';

import { extendObject } from '../util/functions/extend-object.function';

type DeepPartial<T> = T extends () => any ? T : T extends Record<string, any> ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

export class EventContextMock implements EventContext {
  public error: any = null;
  public connection: any = {
    emit: jest.fn(),
    open: jest.fn(),
  };
  public container: any = jest.fn();
  public _context: any = jest.fn();
  public delivery: any = {
    accept: jest.fn(),
    reject: jest.fn(),
    release: jest.fn(),
    isHandled: () => false,
  };
  public receiver: any = {
    get address() {
      return '';
    },
    credit: 0,
    addCredit: jest.fn(),
    close: jest.fn().mockResolvedValue(true),
  };
  public sender: any = {
    send: jest.fn().mockResolvedValue({ sent: true }),
    get address() {
      return '';
    },
  };
  public message: any = {
    _body: '',
    get address() {
      return '';
    },
    set body(body: any) {
      this._body = body;
    },
    get body() {
      return this._body;
    },
  };

  constructor(props?: DeepPartial<EventContextMock>) {
    if (props) {
      extendObject(this, props);
    }
  }
}
