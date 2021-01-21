import * as React from 'react';
import './styles.css';
import Step from './Step';
import { useWorkflowMachine, WorkflowStepDefinition } from './workflow/workflow-factory';
import { useSet } from 'react-use';

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
	const steps: WorkflowStepDefinition[] = [
		{ id: 'details' },
		{ id: 'initiatives', deps: ['details'] },
		{ id: 'schedule', deps: ['details'], softDeps: ['initiatives'] },
		{ id: 'variations', deps: ['details'] },
		{ id: 'run', deps: ['details'], softDeps: ['initatives', 'schedule', 'variations'] },
		{ id: 'analyse', deps: ['run'], outdatable: true, disableProcessFromStates: ['outdated'] },
		{ id: 'publish', deps: ['analyse'], outdatable: true, disableProcessFromStates: ['outdated'] },
	];
	const [validSteps, { toggle, has }] = useSet<string>(new Set(steps.map((s) => s.id)));

	const processStep = ({ id }: { id: string }) =>
		new Promise<void>((resolve, reject) => setTimeout(() => (has(id) ? resolve() : reject()), 200));

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
				{current.value !== 'locked' && (
					<button onClick={handleRunClick(current.value === 'idle' ? 'RUN' : 'STOP')}>
						{current.value === 'idle' ? 'Run' : 'Stop'}
					</button>
				)}
			</div>

			<div>
				<Step
					label="Set Details"
					onClick={handleStepClick('details')}
					active={currentStep === 0}
					number={1}
					state={stepRefs.detailsRef.state.value}
				>
					<StepControls
						stepRefs={stepRefs}
						stepRefId="detailsRef"
						allowEvents={['TOUCH']}
						valid={validSteps.has('details')}
						onValidToggle={handleValidToggle('details')}
					/>
				</Step>

				<Step
					label="Add Initiatives"
					onClick={handleStepClick('initiatives')}
					active={currentStep === 1}
					number={2}
					state={stepRefs.initiativesRef.state.value}
				>
					<StepControls
						stepRefs={stepRefs}
						stepRefId="initiativesRef"
						allowEvents={['TOUCH']}
						valid={validSteps.has('initiatives')}
						onValidToggle={handleValidToggle('initiatives')}
					/>
				</Step>

				<Step
					label="Add Schedule"
					onClick={handleStepClick('schedule')}
					active={currentStep === 2}
					number={3}
					state={stepRefs.scheduleRef.state.value}
				>
					<StepControls
						stepRefs={stepRefs}
						stepRefId="scheduleRef"
						allowEvents={['TOUCH']}
						valid={validSteps.has('schedule')}
						onValidToggle={handleValidToggle('schedule')}
					/>
				</Step>

				<Step
					label="Configure Variations"
					onClick={handleStepClick('variations')}
					active={currentStep === 3}
					number={4}
					state={stepRefs.variationsRef.state.value}
				>
					<StepControls
						stepRefs={stepRefs}
						stepRefId="variationsRef"
						allowEvents={['TOUCH']}
						valid={validSteps.has('variations')}
						onValidToggle={handleValidToggle('variations')}
					/>
				</Step>

				<Step
					label="Run Simulation"
					onClick={handleStepClick('run')}
					active={currentStep === 4}
					number={5}
					state={stepRefs.runRef.state.value}
				>
					<StepControls
						stepRefs={stepRefs}
						stepRefId="runRef"
						valid={validSteps.has('run')}
						onValidToggle={handleValidToggle('run')}
					/>
				</Step>

				<Step
					label="Analyse Simulation"
					onClick={handleStepClick('analyse')}
					active={currentStep === 5}
					number={6}
					state={stepRefs.analyseRef.state.value}
				>
					<StepControls
						stepRefs={stepRefs}
						stepRefId="analyseRef"
						allowEvents={['TOUCH']}
						valid={validSteps.has('analyse')}
						onValidToggle={handleValidToggle('analyse')}
					/>
				</Step>

				<Step
					label="Publish"
					onClick={handleStepClick('publish')}
					active={currentStep === 6}
					number={7}
					state={stepRefs.publishRef.state.value}
				>
					<StepControls
						stepRefs={stepRefs}
						stepRefId="publishRef"
						allowEvents={['TOUCH']}
						valid={validSteps.has('publish')}
						onValidToggle={handleValidToggle('publish')}
					/>
				</Step>
			</div>
		</div>
	);
}
