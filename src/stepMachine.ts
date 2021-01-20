import { Machine, sendParent } from 'xstate';

interface EventHookProps {
	id: string;
}

interface StepMachineFactoryProps {
	id: string;
}

export const stepMachineFactory = (props: StepMachineFactoryProps) => {
	const { id } = props;

	return Machine({
		id,
		initial: 'initial',
		states: {
			initial: {
				on: {
					START: 'ready',
				},
			},
			ready: {
				on: {
					PROCESS: 'processing',
					TOUCHED: 'progress',
				},
			},
			progress: {
				on: {
					PROCESS: 'processing',
					RESET: 'ready',
				},
			},
			processing: {
				// invoke: {
				// 	src: () => process({ id }),
				// 	onDone: {
				// 		target: 'complete',
				// 	},
				// 	onError: {
				// 		target: 'invalid',
				// 	},
				// },
				entry: sendParent({ type: 'STEP_PROCESSING', id }),
				on: {
					VALID: 'complete',
					INVALID: 'invalid',
				},
			},
			complete: {
				entry: sendParent({ type: 'STEP_COMPLETE', id }),
				on: {
					OUTDATED: 'outdated',
					PROCESS: 'processing',
					TOUCHED: 'progress',
				},
			},
			invalid: {
				entry: sendParent({ type: 'STEP_INVALID', id }),
				on: {
					OUTDATED: 'outdated',
					PROCESS: 'processing',
					TOUCHED: 'progress',
				},
			},
			outdated: {
				entry: sendParent({ type: 'STEP_OUTDATED', id }),
				on: {
					PROCESS: 'processing',
					TOUCHED: 'progress',
				},
			},
			locked: {
				type: 'final',
			},
		},
	});
};
