# RPC Authority and Safety

This document is part of the normative [RPC charter](./README.md).

## Admission and Compatibility

- RPC sends no frames before the application admits a transport.
- Admission means the application has completed its required authentication, origin, remote identity, and deployment checks outside RPC.
- After admission, the local and remote nodes establish protocol, transport-representation, required wire-plugin, remote-value, and finite-budget compatibility before application traffic begins.
- The root and all application or plugin-defined values remain undisclosed until compatibility succeeds.
- Incompatible or malformed negotiation terminates the attempted session without creating application authority.
- Reconnection repeats application admission and RPC compatibility as a new session.

## Reachability Is Authority

- The root is the bootstrap authority for one accepted session.
- A node may operate only on the root and references deliberately issued to that session.
- A reference identifier alone grants no authority. Guessing, replaying, or learning another session’s identifier cannot access its value.
- Every reference operation verifies live-session authority. This includes invocation, argument revival, round trips, watching, updates, settlement, release, stream control, and plugin control.
- Delegation occurs only when transmission of the containing value commits successfully. Failed serialization or failed delivery cannot leave authority granted accidentally.
- Released references and references from disconnected sessions are no longer usable, even if their identifiers are replayed.
- Authority and retention are distinct. Retaining an owner-side value does not retain a dead session’s permission to use it.

## Member Exposure

- A server root is a layered capability directory. For any top-level root property, the latest remaining exposure is visible.
- An exposure may atomically replace several top-level properties without changing its layer precedence, and removing it reveals any earlier layer beneath it.
- Existing client sessions observe committed root changes through the same session-scoped root facade. Removing a top-level property does not revoke references already issued from that property.
- Remote object behavior follows deliberately reachable values rather than a separately maintained method manifest.
- Discovery, hydration, and dispatch use one consistent exposure policy.
- Members designated private by that policy are neither disclosed nor invocable through forged lower-level messages.
- Constructors, prototypes, legacy prototype accessors, and other unsafe traversal paths are never remotely reachable implicitly.
- Built-in object methods are not exposed merely because they exist on a prototype.
- Method lookup cannot escape the authorized receiver or execute application getters while determining authority.
- Unknown or forbidden members fail without revealing hidden object shape beyond the failure required by the contract.

## Hostile Input

- Application admission does not make a remote node or its frames trustworthy.
- Canonical messages are structurally validated before hydration, plugin dispatch, correlation, or application invocation.
- Frame size, strings, collections, identifiers, nesting, and plugin payloads are bounded before expensive work where possible.
- Traversal does not invoke constructors, getters, prototype setters, or application behavior merely to inspect a value.
- Prototype-polluting and unsafe property names are rejected consistently.
- Raw structured-clone values and string-decoded values converge to the same validated canonical model.
- Transfer lists cannot smuggle application authority or bypass message validation.
- Malformed input has a defined operation-level or session-terminal outcome and cannot leave partially committed authority or resources.
