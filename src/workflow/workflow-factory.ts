/**
 * Workflow Factory
 */

import { useMemo } from 'react';
import {
	Machine,
	assign,
	spawn,
	send,
	ActorRef,
	ActorRefFrom,
	EventObject,
	ActionObject,
	AnyEventObject,
} from 'xstate';
import { useMachine } from '@xstate/react';
// import { forEachRight } from 'lodash-es';
import { stepMachineFactory } from '../stepMachine';
import { choose, pure, raise } from 'xstate/lib/actions';

export const stepRefId = (id: string) => `${id}Ref`;
export const undoStepRefId = (refId: string) => refId.split('Ref')[0];

const handleStepComplete = pure<WorkflowMachineContext, AnyEventObject>((context, { id }) => {
	const actions: ActionObject<WorkflowMachineContext, EventObject>[] = [];

	const completeStepGraphItem = context.graphMap.get(id);
	if (!completeStepGraphItem) return actions;

	const readyStepRefs = completeStepGraphItem.children ?? [];

	// Ready (unlock) next steps
	readyStepRefs.forEach((item) => {
		context[item.refId]?.send('START');
		actions.push(send('START', { to: context[item.refId] }));
	});

	// Move to next step (if there is one)
	const nextIndex = Math.min(context.currentStepIndex + 1, context.graphIndexMap.size - 1);
	actions.push(
		assign<WorkflowMachineContext>({ currentStepIndex: () => nextIndex })
	);

	return actions;
});

export interface WorkflowStepDefinition {
	id: string;
	deps?: string[];
	process?: () => Promise<void>;
}

type TreeLike<T> = {
	id: string;
	children?: T[];
};

interface Graph extends Required<TreeLike<Graph>> {
	index: number;
	refId: string;
	parents: Graph[];
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
}

export const useWorkflowMachine = (props: WorkflowStateHookProps) => {
	const { id: workflowId = 'workflow', steps } = props;

	// const dependencyGraph
	const workflowMachine = useMemo(() => {
		const _steps = steps ?? [];

		const firstStepId = _steps[0]?.id;
		const stepSpawns = Object.fromEntries(
			_steps.map(({ id, process }) => [
				stepRefId(id),
				() => spawn(stepMachineFactory({ id, onProcess: process }), { sync: true }),
			])
		);
		const stepRefs = Object.fromEntries(Object.keys(stepSpawns).map((k) => [k, null]));

		const graphIndexMap = new Map<number, Graph>();
		const graphMap = new Map<string, Graph>(
			_steps.map(({ id }, index) => [id, { id, refId: stepRefId(id), index, children: [], parents: [] }])
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

			// Update index map
			graphIndexMap.set(graphItem.index, graphItem);
		});

		console.log('graphMap', graphMap);

		return Machine<WorkflowMachineContext>(
			{
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
							RUN: 'running',
							STEP_OUTDATED: {}, // TODO
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
								always: 'process',
							},
							process: {
								entry: send('PROCESS', {
									to: (context) => context[context.graphIndexMap.get(context.runningStepIndex)?.refId || ''],
								}),
								on: {
									STEP_COMPLETE: [
										{
											target: 'done',
											cond: (context) => context.currentStepIndex === context.runningStepIndex,
											actions: handleStepComplete,
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
				},
			},
			{
				actions: {},
				guards: {},
			}
		);
	}, [workflowId, steps]);

	return useMachine(workflowMachine, { devTools: true });
};
