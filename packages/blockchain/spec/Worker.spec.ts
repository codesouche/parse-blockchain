import { Parse } from 'parse/node';
import MQAdapter from '../src/MQAdapter';
import SimpleMQAdapter from '../src/SimpleMQAdapter';
import Worker from '../src/Worker';

describe('Worker', () => {
  beforeAll(() => {
    Parse.initialize('someappid');
  });

  describe('initialize', () => {
    it('should initialize', () => {
      new Worker().initialize({ send: () => undefined });
    });

    it('should not initialize twice', () => {
      const worker = new Worker();
      worker.initialize({ send: () => undefined });
      expect(() => worker.initialize({ send: () => undefined })).toThrowError(
        'The worker is already initialized'
      );
    });

    it('should initialize with custom adapter', () => {
      class FakeAdapter implements MQAdapter {
        publish: (queue: string, message: string) => void;
        consume() {
          return {
            unsubscribe: () => undefined,
          };
        }
      }

      const fakeAdapter = new FakeAdapter();

      const worker = new Worker();
      worker.initialize({ send: () => undefined }, fakeAdapter);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((worker as any).mqAdapter).toBe(fakeAdapter);
    });
  });

  describe('handleMessage', () => {
    it('should send messages to the blockchain adapter', (done) => {
      const simpleMQAdapter = new SimpleMQAdapter();

      const someObject = new Parse.Object('SomeClass');
      someObject.id = 'someid';

      const worker = new Worker();
      worker.initialize(
        {
          send: (parseObjectFullJSON: Record<string, unknown>) => {
            expect(parseObjectFullJSON).toEqual(someObject._toFullJSON());
            done();
          },
        },
        simpleMQAdapter
      );

      simpleMQAdapter.publish(
        `${Parse.applicationId}-parse-server-blockchain`,
        JSON.stringify(someObject._toFullJSON())
      );
    });

    it('should retry in the case of error sending messages to the blockchain adapter', (done) => {
      const simpleMQAdapter = new SimpleMQAdapter();

      const someObject = new Parse.Object('SomeClass');
      someObject.id = 'someid';

      let sendCounter = 0;

      const worker = new Worker();
      worker.initialize(
        {
          send: (parseObjectFullJSON: Record<string, unknown>) => {
            expect(parseObjectFullJSON).toEqual(someObject._toFullJSON());
            sendCounter++;
            if (sendCounter === 6) {
              done();
            } else {
              throw Error();
            }
          },
        },
        simpleMQAdapter
      );

      simpleMQAdapter.publish(
        `${Parse.applicationId}-parse-server-blockchain`,
        JSON.stringify(someObject._toFullJSON())
      );
    }, 15000);
  });
});
