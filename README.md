# Streamable
A common problem in streamed Roblox experiences is dealing with the existence of instances on the client. 

The Streamable package seeks to solve this complexity by providing a series of helper functions. These functions observe the existence of instances as they stream in and out of existence.

## `observeChild`
```ts
function observeChild(
	parent: Instance,
	childName: string,
	observer: (child: Instance) => () => void,
): () => void
```
Observe the existence of a given child within a parent instance. The observer function is called each time that the child comes into existence, and the returned callback is called when the instance goes away.

The function returns a "stop" callback which can be called to stop and clean up the observation process entirely. If called while the given instance exists, the inner returned function (i.e. the function that runs when the instance goes away) is called too.

If the top-level parent is destroyed, the observation is automatically stopped.
```ts
const stop = observeChild(workspace, "Baseplate", (baseplate) => {
	print("Baseplate exists");
	return () => {
		print("Baseplate is gone");
	};
});
```

## `observeDescendant`
```ts
function observeDescendant(
	parent: Instance,
	descendantName: string,
	observer: (descendant: Instance) => () => void,
): () => void
```
This is the same as `observeChild`, except it observes across all descendants of the given `parent` instance.

## `observeChildren`
```ts
function observeChildren<T extends string>(
	parent: Instance,
	childrenNames: Record<T, string>,
	observer: (children: Record<T, Instance>) => () => void,
): () => void
```
Observes a collection of children within the given `parent` instance. When _all_ children are present, the `observer` will be called. When _any_ of the children are no longer present, the observer's returned function is called. In other words, this observer can guarantee the existence of a compound group of instances.

The returned function can be called to stop the observation process, which is also automatically called if the `parent` instance is destroyed.

```ts
const stop = observeChildren(
	workspace,
	{
		// Custom mapping of keys to instance names:
		Ground: "Baseplate",
		Spawn: "SpawnLocation",
	},
	(children) => {
		// Use the same keys from above to access the actual instances:
		print(children.Ground, children.Spawn);
		return () => {
			print("Ground and/or spawn no longer present");
		};
	},
)
```

## `observeDescendants`
```ts
function observeDescendants<T extends string>(
	parent: Instance,
	descendantNames: Record<T, string>,
	observer: (descendants: Record<T, Instance>) => () => void,
): () => void
```
This is the same as `observeChildren`, except it observes across all descendants of the given `parent` instance.
