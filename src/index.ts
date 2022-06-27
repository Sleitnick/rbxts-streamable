export type ObserverFn = (instance: Instance) => () => void;

function observeInstance(parent: Instance, instanceName: string, recursive: boolean, observer: ObserverFn): () => void {
	let queuedParentThread: thread | undefined;
	let observerCleanupFn: (() => void) | undefined;
	let observedInstance: Instance | undefined;
	const connections = new Array<RBXScriptConnection>();

	const cleanupAll = () => {
		if (queuedParentThread !== undefined) {
			task.cancel(queuedParentThread);
			queuedParentThread = undefined;
		}
		for (const connection of connections) {
			connection.Disconnect();
		}
		table.clear(connections);
		if (observerCleanupFn !== undefined) {
			task.spawn(observerCleanupFn);
			observerCleanupFn = undefined;
		}
	};

	const queueDeparented = () => {
		if (queuedParentThread !== undefined) {
			task.cancel(queuedParentThread);
		}
		queuedParentThread = undefined;
		observedInstance = undefined;
		if (observerCleanupFn !== undefined) {
			task.spawn(observerCleanupFn);
			observerCleanupFn = undefined;
		}
	};

	const queueParented = (instance: Instance) => {
		if (queuedParentThread !== undefined) {
			task.cancel(queuedParentThread);
		}
		observedInstance = instance;
		queuedParentThread = task.defer(() => {
			queuedParentThread = undefined;
			observerCleanupFn = observer(instance);
		});
	};

	// Handle initial state:
	{
		const instance = parent.FindFirstChild(instanceName, recursive);
		if (instance !== undefined) {
			queueParented(instance);
		}
	}

	// Listen for instances added/removed from the parent instance:
	connections.push(
		(recursive ? parent.DescendantAdded : parent.ChildAdded).Connect((instance) => {
			if (observedInstance === undefined && instance.Name === instanceName) {
				queueParented(instance);
			}
		}),
	);
	connections.push(
		(recursive ? parent.DescendantRemoving : parent.ChildRemoved).Connect((instance) => {
			if (instance === observedInstance) {
				queueDeparented();
			}
		}),
	);

	// Stop observing if the parent is destroyed:
	connections.push(parent.Destroying.Connect(cleanupAll));

	return cleanupAll;
}

export function observeChild(parent: Instance, childName: string, observer: ObserverFn): () => void {
	return observeInstance(parent, childName, false, observer);
}

export function observeDescendant(parent: Instance, descendantName: string, observer: ObserverFn): () => void {
	return observeInstance(parent, descendantName, true, observer);
}

function observeInstances<T extends string>(
	parent: Instance,
	instanceNames: Record<T, string>,
	recursive: boolean,
	observer: (instances: Record<T, Instance>) => () => void,
): () => void {
	const observerCleanups = new Array<() => void>();
	const instances = new Map<T, Instance>();
	let onInstancesChangedThread: thread | undefined;
	let observerCleanupFn: (() => void) | undefined;
	let numInstances = 0;

	const onInstancesChanged = () => {
		if (onInstancesChangedThread !== undefined) {
			task.cancel(onInstancesChangedThread);
		}
		onInstancesChangedThread = task.defer(() => {
			onInstancesChangedThread = undefined;
			const size = instances.size();
			if (size === numInstances) {
				observerCleanupFn = observer(instances as unknown as Record<T, Instance>);
			} else {
				if (observerCleanupFn) {
					const fn = observerCleanupFn;
					observerCleanupFn = undefined;
					fn();
				}
			}
		});
	};

	// eslint-disable-next-line roblox-ts/no-array-pairs
	for (const [recordName, instanceName] of pairs(instanceNames)) {
		numInstances++;
		observerCleanups.push(
			observeInstance(parent, instanceName as string, recursive, (instance) => {
				instances.set(recordName as T, instance);
				onInstancesChanged();
				return () => {
					instances.delete(recordName as T);
					onInstancesChanged();
				};
			}),
		);
	}

	return () => {
		if (onInstancesChangedThread !== undefined) {
			task.cancel(onInstancesChangedThread);
		}
		for (const cleanup of observerCleanups) {
			cleanup();
		}
	};
}

export function observeChildren<T extends string>(
	parent: Instance,
	childrenNames: Record<T, string>,
	observer: (instances: Record<T, Instance>) => () => void,
): () => void {
	return observeInstances(parent, childrenNames, false, observer);
}

export function observeDescendants<T extends string>(
	parent: Instance,
	descendantNames: Record<T, string>,
	observer: (instances: Record<T, Instance>) => () => void,
): () => void {
	return observeInstances(parent, descendantNames, true, observer);
}
