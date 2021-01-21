import { Machine, sendParent } from 'xstate';

export interface StepMachineFactoryProps {
	id: string;
	context?: Partial<StepMachineContext>;
}

export interface StepMachineContext {
	alwaysProcess?: boolean;
	disableProcessFromStates: ('ready' | 'outdatable' | 'outdated' | 'complete' | 'invalid')[];
}

export const stepMachineFactory = ({ id, context = {} }: StepMachineFactoryProps) =>
	Machine<StepMachineContext>({
		id,
		initial: 'initial',
		context: {
			alwaysProcess: false,
			disableProcessFromStates: [],
			...context,
		},
		states: {
			initial: {
				on: {
					START: 'ready',
					OUTDATABLE: 'outdatable',
				},
			},
			ready: {
				on: {
					PROCESS: [
						{
							target: 'processing',
							cond: (context) => !context.disableProcessFromStates.includes('ready'),
						},
						{
							actions: sendParent({ type: 'STEP_INVALID', id }),
							cond: (context) => context.disableProcessFromStates.includes('ready'),
						},
					],
					TOUCH: 'touched',
					OUTDATABLE: 'outdatable',
				},
			},
			outdatable: {
				on: {
					PROCESS: [
						{
							target: 'processing',
							cond: (context) => !context.disableProcessFromStates.includes('outdatable'),
						},
						{
							actions: sendParent({ type: 'STEP_INVALID', id }),
							cond: (context) => context.disableProcessFromStates.includes('outdatable'),
						},
					],
					TOUCH: 'touched',
					OUTDATE: 'outdated',
				},
			},
			touched: {
				entry: sendParent({ type: 'STEP_TOUCHED', id }),
				on: {
					PROCESS: 'processing',
					RESET: 'ready',
				},
			},
			processing: {
				entry: sendParent({ type: 'STEP_PROCESSING', id }),
				on: {
					VALID: 'complete',
					INVALID: 'invalid',
				},
			},
			complete: {
				entry: sendParent({ type: 'STEP_COMPLETE', id }),
				on: {
					OUTDATE: 'outdated',
					PROCESS: [
						// Force running of every step when workflow is running
						{
							target: 'processing',
							cond: (context) =>
								Boolean(context.alwaysProcess) && !context.disableProcessFromStates.includes('complete'),
						},
						{
							actions: sendParent({ type: 'STEP_INVALID', id }),
							cond: (context) =>
								Boolean(context.alwaysProcess) && context.disableProcessFromStates.includes('complete'),
						},

						// Skip step when workflow is running
						{
							actions: sendParent('STEP_SKIP'),
							cond: (context) => !context.alwaysProcess,
						},
					],
					TOUCH: 'touched',
					LOCK: 'locked',
				},
			},
			invalid: {
				entry: sendParent({ type: 'STEP_INVALID', id }),
				on: {
					OUTDATE: 'outdated',
					PROCESS: [
						{
							target: 'processing',
							cond: (context) => !context.disableProcessFromStates.includes('invalid'),
						},
						{
							actions: sendParent({ type: 'STEP_INVALID', id }),
							cond: (context) => context.disableProcessFromStates.includes('invalid'),
						},
					],
					TOUCH: 'touched',
				},
			},
			outdated: {
				entry: sendParent({ type: 'STEP_OUTDATED', id }),
				on: {
					PROCESS: [
						{
							target: 'processing',
							cond: (context) => !context.disableProcessFromStates.includes('outdated'),
						},
						{
							actions: sendParent({ type: 'STEP_INVALID', id }),
							cond: (context) => context.disableProcessFromStates.includes('outdated'),
						},
					],
					TOUCH: 'touched',
				},
			},
			locked: {
				type: 'final',
			},
		},
	});
