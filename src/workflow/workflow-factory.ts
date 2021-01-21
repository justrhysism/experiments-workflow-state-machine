/**
 * Workflow Factory
 */

import { useMemo } from 'react';
import { Machine, assign, spawn, send, EventObject, ActionObject, AnyEventObject } from 'xstate';
import { useMachine } from '@xstate/react';
import { stepMachineFactory, StepMachineContext, StepMachineFactoryProps } from '../stepMachine';
import { pure } from 'xstate/lib/actions';

export const stepRefId = (id: string) => `${id}Ref`;
export const undoStepRefId = (refId: string) => refId.split('Ref')[0];

const handleStepCompleteAction = pure<WorkflowMachineContext, AnyEventObject>((context, { id }) => {
	const actions: ActionObject<WorkflowMachineContext, EventObject>[] = [];

	const completeStepGraphItem = context.graphMap.get(id);
	if (!completeStepGraphItem) return actions;

	const readyStepRefs = completeStepGraphItem.children ?? [];

	// Ready (unlock) next steps
	readyStepRefs.forEach((step) => {
		actions.push(send(step.readyEvent, { to: context[step.refId] }));
	});

	// Move to next step (if there is one)
	const nextIndex = Math.min(context.currentStepIndex + 1, context.graphIndexMap.size - 1);
	actions.push(
		assign<WorkflowMachineContext>({ currentStepIndex: () => nextIndex })
	);

	// Final step, lock workflow
	const finalStep = context.graphIndexMap.get(context.graphIndexMap.size - 1);
	if (id === finalStep?.id) {
		context.graphMap.forEach((step) => actions.push(send('LOCK', { to: context[step.refId] })));
		actions.push(send('LOCK'));
	}

	return actions;
});

const getAllDependencies = (graph: Graph, soft: boolean = false): Graph[] =>
	[
		graph.children,
		graph.children.map((c) => getAllDependencies(c)).flat(),
		(soft ? [graph.related, graph.related.map((c) => getAllDependencies(c, true))].flat() : []).flat(),
	].flat();

const handleStepTouchAction = pure<WorkflowMachineContext, AnyEventObject>((context, { id }) => {
	const touched = context.graphMap.get(id);
	if (!touched) return [];
	const outdatedSteps = getAllDependencies(touched, true);

	return outdatedSteps.map((outdated) => send('OUTDATE', { to: context[outdated.refId] }));
});

export interface WorkflowStepDefinition extends StepMachineFactoryProps {
	deps?: string[];
	softDeps?: string[];
	outdatable?: boolean;
}

type TreeLike<T> = {
	id: string;
	children?: T[];
};

interface Graph extends Required<TreeLike<Graph>> {
	index: number;
	refId: string;
	parents: Graph[];
	related: Graph[];
	readyEvent: 'START' | 'OUTDATABLE';
}

interface WorkflowMachineContext {
	currentStepIndex: number;
	runningStepIndex: number;
	graphMap: Map<string, Graph>;
	graphIndexMap: Map<number, Graph>;
	[s: string]: any;
}

export interface WorkflowStateHookProps {
	id?: string;
	steps?: WorkflowStepDefinition[];
	onProcess?: (props: { id: string }) => Promise<void>;
}

export const useWorkflowMachine = (props: WorkflowStateHookProps) => {
	const { id: workflowId = 'workflow', steps, onProcess = async () => void 0 } = props;

	// const dependencyGraph
	const workflowMachine = useMemo(
		() => {
			const _steps = steps ?? [];

			const firstStepId = _steps[0]?.id;
			const stepSpawns = Object.fromEntries(
				_steps.map(({ id, context }) => [
					stepRefId(id),
					() => spawn(stepMachineFactory({ id, context }), { sync: true }),
				])
			);
			const stepRefs = Object.fromEntries(Object.keys(stepSpawns).map((k) => [k, null]));

			const graphIndexMap = new Map<number, Graph>();
			const graphMap = new Map<string, Graph>(
				_steps.map(({ id, outdatable }, index) => [
					id,
					{
						id,
						refId: stepRefId(id),
						index,
						children: [],
						parents: [],
						related: [],
						readyEvent: outdatable ? 'OUTDATABLE' : 'START',
					},
				])
			);

			_steps.forEach((step) => {
				const graphItem = graphMap.get(step.id);
				if (!graphItem) return;

				step.deps?.forEach((depId) => {
					const depGraphItem = graphMap.get(depId);
					if (!depGraphItem) return;

					graphItem.parents.push(depGraphItem);
					depGraphItem.children.push(graphItem);
				});

				step.softDeps?.forEach((depId) => {
					const depGraphItem = graphMap.get(depId);
					if (!depGraphItem) return;

					depGraphItem.related.push(graphItem);
				});

				// Update index map
				graphIndexMap.set(graphItem.index, graphItem);
			});

			console.log('graphMap', graphMap);

			return Machine<WorkflowMachineContext>({
				id: workflowId,
				initial: 'initial',
				context: {
					currentStepIndex: 0,
					runningStepIndex: -1,
					graphMap,
					graphIndexMap,
					...stepRefs,
				},
				states: {
					initial: {
						entry: assign<WorkflowMachineContext>({
							...stepSpawns,
						}),
						always: 'start',
					},
					start: {
						entry: send('START', { to: (context) => context[stepRefId(firstStepId)] }),
						always: 'idle',
					},
					idle: {
						entry: assign<WorkflowMachineContext>({ runningStepIndex: () => -1 }),
						on: {
							LOCK: 'locked',
							RUN: 'running',
							STEP_TOUCHED: {
								actions: handleStepTouchAction,
							},
							'currentStep.UPDATE': {
								actions: assign({
									currentStepIndex: (context, { value }) => {
										if (typeof value === 'number') return value;
										return context.graphMap.get(value)?.index ?? 0;
									},
								}),
								cond: (context, { value }) => context[`${value}Ref`]?.state.value !== 'initial',
							},
						},
					},
					running: {
						initial: 'queue',
						entry: assign({ runningStepIndex: (context) => -1 }),
						on: {
							STOP: 'idle',
						},
						states: {
							queue: {
								entry: assign({ runningStepIndex: (context) => (context.runningStepIndex ?? 0) + 1 }),
								always: 'ready',
							},
							ready: {
								entry: send('PROCESS', {
									to: (context) => context[context.graphIndexMap.get(context.runningStepIndex)?.refId || ''],
								}),
								on: {
									STEP_PROCESSING: 'process',
									STEP_SKIP: [
										{
											target: 'done',
											cond: (context) => context.currentStepIndex === context.runningStepIndex,
											actions: assign({ currentStepIndex: (context) => context.currentStepIndex + 1 }),
										},
										{ target: 'queue' },
									],
								},
							},
							process: {
								invoke: {
									src: 'process',
									onDone: {
										actions: send('VALID', {
											to: (context) => context[context.graphIndexMap.get(context.runningStepIndex)?.refId || ''],
										}),
									},
									onError: {
										actions: send('INVALID', {
											to: (context) => context[context.graphIndexMap.get(context.runningStepIndex)?.refId || ''],
										}),
									},
								},
								on: {
									STEP_COMPLETE: [
										{
											target: 'done',
											cond: (context) => context.currentStepIndex === context.runningStepIndex,
											actions: handleStepCompleteAction,
										},
										{ target: 'queue' },
									],
									STEP_INVALID: {
										target: 'done',
										actions: assign({ currentStepIndex: (context) => context.runningStepIndex }),
									},
								},
							},
							done: {
								type: 'final',
								exit: assign({ runningStepIndex: (context) => -1 }),
							},
						},
						onDone: 'idle',
					},
					locked: {
						on: {
							'currentStep.UPDATE': {
								actions: assign({
									currentStepIndex: (context, { value }) => {
										if (typeof value === 'number') return value;
										return context.graphMap.get(value)?.index ?? 0;
									},
								}),
								cond: (context, { value }) => context[`${value}Ref`]?.state.value !== 'initial',
							},
						},
					},
				},
			});
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[]
	);

	return useMachine(workflowMachine, {
		devTools: true,
		services: {
			process: (context, event) => {
				const currentItem = context.graphIndexMap.get(context.runningStepIndex);

				if (!currentItem) return Promise.resolve();
				return onProcess({ id: currentItem?.id });
			},
		},
	});
};
