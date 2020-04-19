import Component from '@ember/component';
import { tracked } from '@glimmer/tracking';
import { get, getProperties } from '@ember/object';
import { isPresent, isNone } from '@ember/utils';
import { schedule } from '@ember/runloop';
import { assert } from '@ember/debug';
import { action, computed } from '@ember/object';

import CircularStateMachine from '../-private/state-machine/circular';
import LinearStateMachine from '../-private/state-machine/linear';

import StepNode from '../-private/step-node';

/**
 * A component for creating a set of "steps", where only one is visible at a time
 *
 * ```hbs
 * {{#step-manager as |w|}}
 *   {{#w.step}}
 *     The first step
 *   {{/w.step}}
 *
 *   {{#w.step}}
 *     The second step
 *   {{/w.step}}
 *
 *   <button {{action w.transition-to-next}}>
 *     Next Step
 *   </button>
 * {{/step-manager}}
 * ```
 *
 * @class StepManagerComponent
 * @yield {hash} w
 * @yield {Component} w.step Renders a step
 * @yield {Action} w.transition-to
 * @yield {Action} w.transition-to-next Render the next step
 * @yield {Action} w.transition-to-previous Render the previous step
 * @yield {StepName} w.currentStep The name of the current step
 * @yield {Array<String>} w.steps All of the step names that are currently defined, in order
 * @public
 * @hide
 */
export default class StepManagerComponent extends Component {
  tagName = '';

  /* Optionally can be provided to override the initial step to render */
  initialStep;

  /**
   * The `currentStep` property can be used for providing, or binding to, the
   * name of the current step.
   *
   * If provided, the initial step will come from the value of this property,
   * and the value will be updated whenever the step changes
   *
   * @property {string} currentStep
   * @public
   */
  currentStep;

  /**
   * Called when the state machine transitions, if provided
   *
   * Passed the new step identifier
   *
   * @property {function} onTransition;
   * @public
   */
  onTransition;

  /**
   * @property {boolean} boolean
   * @public
   */
  linear;

  /**
   * @property {boolean} boolean
   * @private
   */
  _watchCurrentStep;

  /**
   * @property {BaseStateMachine} transitions state machine for transitions
   * @private
   */
  @tracked transitions;

  init() {
    super.init();

    const { initialStep, currentStep } = getProperties(
      this,
      'initialStep',
      'currentStep'
    );

    this._watchCurrentStep = isPresent(currentStep);
    const startingStep = isNone(initialStep) ? currentStep : initialStep;

    if (!isPresent(this.linear)) {
      this.linear = true;
    }

    const StateMachine = this.linear
      ? LinearStateMachine
      : CircularStateMachine;

    this.transitions = new StateMachine(startingStep);
  }

  @computed('transitions.{currentStep,length}')
  get hasNextStep() {
    return !isNone(this.transitions.pickNext());
  }

  @computed('transitions.{currentStep,length}')
  get hasPreviousStep() {
    return !isNone(this.transitions.pickPrevious());
  }

  didUpdateAttrs() {
    if (this._watchCurrentStep) {
      const newStep = this.currentStep;

      if (typeof newStep === 'undefined') {
        this.transitionTo(this.transitions.firstStep);
      } else {
        this.transitionTo(newStep);
      }
    }
  }

  @action
  registerStepComponent(stepComponent) {
    stepComponent.transitions = this.transitions;

    schedule('actions', () => {
      this.transitions.addStep(stepComponent);
    });
  }

  @action
  removeStepComponent(stepComponent) {
    schedule('actions', () => {
      this.transitions.removeStep(stepComponent);
    });
  }

  @action
  updateStepNode(stepComponent, field, value) {
    const name = get(stepComponent, 'name');

    this.transitions.updateStepNode(name, field, value);
  }

  @action
  transitionTo(to) {
    const destination = to instanceof StepNode ? to.name : to;
    const onTransition = get(this, 'onTransition');

    this.transitions.activate(destination);

    if (onTransition) {
      onTransition(destination);
    }
  }

  @action
  transitionToNext() {
    const to = this.transitions.pickNext();

    assert('There is no next step', !isNone(to));

    this.transitionTo(to);
  }

  @action
  transitionToPrevious() {
    const to = this.transitions.pickPrevious();

    assert('There is no previous step', !isNone(to));

    this.transitionTo(to);
  }
}
