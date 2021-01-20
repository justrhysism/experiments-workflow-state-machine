import * as React from 'react';
import './styles.css';
import { Machine, assign, spawn } from 'xstate';
import { useMachine } from '@xstate/react';
import { stepMachineFactory } from './stepMachine';
import Step from './Step';
import { useWorkflowMachine, WorkflowStepDefinition } from './workflow/workflow-factory';
import { useSet } from 'react-use';
import { useRef } from 'react';

// interface Context {
// 	steps: {
// 		details: null | ActorRef,
// 		initiatives: null,
// 		schedule: null,
// 		variations: null,
// 		run: null,
// 		analyse: null,
// 		publish: null
// 	}
// }

const StateControls: React.FC<{ stepRefs: any; stepRefId: string }> = ({ stepRefs, stepRefId }) =>
	stepRefs[stepRefId].state.nextEvents
		.filter((event: string) => !event.includes('done') && !event.includes('error'))
		.map((event: string) => (
			<button
				key={event}
				className="action"
				onClick={() => {
					stepRefs[stepRefId].send(event);
				}}
			>
				{event}
			</button>
		));

const StepControls: React.FC<{
	stepRefs: any;
	stepRefId: string;
	allowEvents?: string[];
	valid?: boolean;
	onValidToggle?: (valid?: boolean) => void;
}> = (props) => {
	const { stepRefs, stepRefId, allowEvents = [], valid = false, onValidToggle: onValidToggled } = props;

	return (
		<>
			<label style={{ whiteSpace: 'nowrap', marginRight: '1rem' }}>
				<input type="checkbox" checked={valid} onChange={() => onValidToggled?.()} /> Valid
			</label>
			{stepRefs[stepRefId].state.nextEvents
				.filter((event: string) => allowEvents.includes(event))
				.map((event: string) => (
					<button
						key={event}
						className="action"
						onClick={() => {
							stepRefs[stepRefId].send(event);
						}}
					>
						{event}
					</button>
				))}
		</>
	);
};

export default function App() {
	const [validSteps, { toggle, has }] = useSet<string>(new Set(['initiatives']));

	const processStep = ({ id }: { id: string }) =>
		new Promise<void>((resolve, reject) => setTimeout(() => (has(id) ? resolve() : reject()), 500));

	const steps = [
		{ id: 'details' },
		{ id: 'initiatives', deps: ['details'] },
		{ id: 'schedule', deps: ['initiatives'] },
		{ id: 'variations', deps: ['initiatives'] },
		{ id: 'run', deps: ['details', 'schedule', 'variations'] },
	];

	const [current, send] = useWorkflowMachine({ steps, onProcess: processStep });
	console.log(current);
	const { currentStepIndex: currentStep, ...stepRefs } = current.context;

	const handleRunClick = (action: string) => () => {
		send(action);
	};

	const handleStepClick = (step: string) => () => {
		send('currentStep.UPDATE', { value: step });
	};

	const handleValidToggle = (step: string) => () => toggle(step);

	return (
		<div className="App">
			<div>
				<h1>Workflow</h1>
			</div>

			<div className="button-container">
				<button onClick={handleRunClick(current.value === 'idle' ? 'RUN' : 'STOP')}>
					{current.value === 'idle' ? 'Run' : 'Stop'}
				</button>
			</div>

			<div>
				<Step
					label="Set Details"
					onClick={handleStepClick('details')}
					active={currentStep === 0}
					state={stepRefs.detailsRef.state.value}
				>
					<StepControls
						stepRefs={stepRefs}
						stepRefId="detailsRef"
						allowEvents={['TOUCHED']}
						valid={validSteps.has('details')}
						onValidToggle={handleValidToggle('details')}
					/>
				</Step>

				<Step
					label="Add Initiatives"
					onClick={handleStepClick('initiatives')}
					active={currentStep === 1}
					state={stepRefs.initiativesRef.state.value}
				>
					<StepControls
						stepRefs={stepRefs}
						stepRefId="initiativesRef"
						allowEvents={['TOUCHED']}
						valid={validSteps.has('initiatives')}
						onValidToggle={handleValidToggle('initiatives')}
					/>
				</Step>

				<Step
					label="Add Schedule"
					onClick={handleStepClick('schedule')}
					active={currentStep === 2}
					state={stepRefs.scheduleRef.state.value}
				>
					<StepControls
						stepRefs={stepRefs}
						stepRefId="scheduleRef"
						allowEvents={['TOUCHED']}
						valid={validSteps.has('schedule')}
						onValidToggle={handleValidToggle('schedule')}
					/>
				</Step>

				<Step
					label="Configure Variations"
					onClick={handleStepClick('variations')}
					active={currentStep === 3}
					state={stepRefs.variationsRef.state.value}
				>
					<StepControls
						stepRefs={stepRefs}
						stepRefId="variationsRef"
						allowEvents={['TOUCHED']}
						valid={validSteps.has('variations')}
						onValidToggle={handleValidToggle('variations')}
					/>
				</Step>

				<Step
					label="Run Simulation"
					onClick={handleStepClick('run')}
					active={currentStep === 4}
					state={stepRefs.runRef.state.value}
				>
					<StepControls
						stepRefs={stepRefs}
						stepRefId="runRef"
						valid={validSteps.has('run')}
						onValidToggle={handleValidToggle('run')}
					/>
				</Step>
				{/* <Step label="Analyse Simulation" disabled />
				<Step label="Publish" disabled /> */}
			</div>
		</div>
	);
}
