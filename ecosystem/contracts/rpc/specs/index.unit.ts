import {describe, expectTypeOf, it} from 'vitest';
import type {
  RpcApiFragment,
  RpcClient,
  RpcClientEventMap,
  RpcConnectedSession,
  RpcNode,
  RpcCompatibility,
  RpcRemote,
  RpcRemoteRoot,
  RpcServer,
  RpcServerEventMap,
  RpcSession,
} from '..';

interface Project {
  id: string;
  rename(name: string): void;
}

interface ServerApi {
  version: string;
  add(first: number, second: number): number;
  getProject(id: string): Project;
}

interface ClientApi {
  notify(message: string): Promise<void>;
}

describe('RPC endpoint projection', () => {
  it('projects the client root automatically from the server-owned API', () => {
    type Client = RpcClient<ServerApi>;
    type Root = Client['root'];

    expectTypeOf<Root>().toEqualTypeOf<RpcRemoteRoot<ServerApi>>();
    expectTypeOf<ReturnType<Root['add']>>().toEqualTypeOf<Promise<number>>();
    expectTypeOf<ReturnType<Root['getProject']>>().toEqualTypeOf<Promise<RpcRemote<Project>>>();
  });

  it('uses remote-local order consistently across conventional endpoints', () => {
    type Server = RpcServer<ClientApi, ServerApi>;
    type Client = RpcClient<ServerApi, ClientApi>;

    expectTypeOf<Server['node']>().toEqualTypeOf<RpcNode<ClientApi, ServerApi>>();
    expectTypeOf<Client['node']>().toEqualTypeOf<RpcNode<ServerApi, ClientApi>>();
    expectTypeOf<Server['sessions']>().toEqualTypeOf<
      ReadonlySet<RpcSession<ClientApi, ServerApi>>
    >();
    expectTypeOf<Client['session']>().toEqualTypeOf<
      RpcConnectedSession<ServerApi, ClientApi> | undefined
    >();
  });

  it('keeps server exposures in the unprojected owner-side shape', () => {
    type Server = RpcServer<ClientApi, ServerApi>;
    type ExposureInput = Parameters<Server['expose']>[0];

    expectTypeOf<ExposureInput>().toEqualTypeOf<RpcApiFragment<ServerApi>>();
    expectTypeOf<NonNullable<ExposureInput['add']>>().toEqualTypeOf<
      (first: number, second: number) => number
    >();
  });

  it('preserves directional node and session APIs beneath endpoint facades', () => {
    type Server = RpcServer<ClientApi, ServerApi>;
    type Client = RpcClient<ServerApi, ClientApi>;

    expectTypeOf<Awaited<ReturnType<Server['admit']>>>().toEqualTypeOf<
      RpcSession<ClientApi, ServerApi>
    >();
    expectTypeOf<Awaited<ReturnType<Client['connect']>>>().toEqualTypeOf<
      RpcConnectedSession<ServerApi, ClientApi>
    >();
    expectTypeOf<Awaited<ReturnType<Client['reconnect']>>>().toEqualTypeOf<
      RpcConnectedSession<ServerApi, ClientApi>
    >();
  });

  it('exposes active negotiated wire plugins in compatibility', () => {
    expectTypeOf<RpcCompatibility['plugins']>().toEqualTypeOf<
      readonly {
        readonly id: string;
        readonly protocol: string;
        readonly valueNamespaces: readonly string[];
        readonly messageNamespaces: readonly string[];
      }[]
    >();
  });

  it('bubbles directionally correct session event payloads', () => {
    type ServerEvents = RpcServerEventMap<ClientApi, ServerApi>;
    type ClientEvents = RpcClientEventMap<ServerApi, ClientApi>;

    expectTypeOf<ServerEvents['rpc:session.accepted']>().toEqualTypeOf<
      RpcSession<ClientApi, ServerApi>
    >();
    expectTypeOf<ClientEvents['rpc:session.connected']>().toEqualTypeOf<
      RpcConnectedSession<ServerApi, ClientApi>
    >();
    expectTypeOf<ClientEvents['rpc:session.connected']['root']>().toEqualTypeOf<
      RpcRemoteRoot<ServerApi>
    >();
  });
});
