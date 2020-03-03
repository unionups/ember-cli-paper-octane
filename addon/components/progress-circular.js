import Component from '@glimmer/component';
import clamp from '../utils/clamp';
import { action } from "@ember/object";

/**
 * @private
 * T (period) = 1 / f (frequency)
 * TICK = 1 / 60hz = 0,01667s = 17ms
 */
const TICK = 17;

const rAF = !window.requestAnimationFrame ? function(fn) {
  return setTimeout(fn, TICK);
} : window.requestAnimationFrame;

const cAF = !window. cancelAnimationFrame ? function(fn) {
  return clearTimeout(fn, TICK);
} : window. cancelAnimationFrame;

const now = () => new Date().getTime();

function linearEase(t, b, c, d) {
  return c * t / d + b;
}

function materialEase(t, b, c, d) {
  // via http://www.timotheegroleau.com/Flash/experiments/easing_function_generator.htm
  // with settings of [0, 0, 1, 1]
  let ts = (t /= d) * t;
  let tc = ts * t;
  return b + c * (6 * tc * ts + -15 * ts * ts + 10 * tc);
}

export default class ProgressCircularComponent extends Component {
    
    get diameter(){
        return this.args.diameter ?? 50;
    }

    get radius(){
        return this.diameter / 2;
    }

    get strokeRatio(){
        return this.args.strokeRatio ?? 0.1;
    }
    
    
    durationIndeterminate = 1333;
    easeFnIndeterminate = materialEase;
    startIndeterminate  = 1;
    endIndeterminate = 149;

    lastDrawFrame;

    get strokeWidth() {
        return this.strokeRatio * this.diameter;
    }

    get strokeDasharray() {
        if (this.args.value) {
            return (this.diameter - this.strokeWidth) * Math.PI;
        } else {
            return (this.diameter - this.strokeWidth) * Math.PI * 0.75;
        }
    }

    get d() {
        return this.getSvgArc(this.diameter, this.strokeWidth, !this.args.value);
    }

    get pathDiameter() {
        return this.diameter - this.strokeWidth;
    }
    

   /**
   * Returns SVG path data for progress circle
   * Syntax spec: https://www.w3.org/TR/SVG/paths.html#PathDataEllipticalArcCommands
   *
   * @param {number} diameter Diameter of the container.
   * @param {number} strokeWidth Stroke width to be used when drawing circle
   * @param {boolean} indeterminate Use if progress circle will be used for indeterminate
   *
   * @returns {string} String representation of an SVG arc.
   */
    getSvgArc(diameter, strokeWidth, indeterminate) {
        let radius = diameter / 2;
        let offset = strokeWidth / 2;
        let start = `${radius},${offset}`; // ie: (25, 2.5) or 12 o'clock
        let end = `${offset},${radius}`;   // ie: (2.5, 25) or  9 o'clock
        let arcRadius = radius - offset;

        /* eslint-disable */
        return 'M' + start
            + 'A' + arcRadius + ',' + arcRadius + ' 0 1 1 ' + end // 75% circle
            + (indeterminate ? '' : 'A' + arcRadius + ',' + arcRadius + ' 0 0 1 ' + start); // loop to start
        /* eslint-enable */
    }

    iterationCount = 0;
    startIndeterminateAnimation() {
        this.renderCircle(this.startIndeterminate, this.endIndeterminate,
        this.easeFnIndeterminate, this.durationIndeterminate, this.iterationCount, 75);

        // The % 4 technically isn't necessary, but it keeps the rotation
        // under 360, instead of becoming a crazy large number.
        this.iterationCount = ++this.iterationCount % 4;
    }

    startDeterminateAnimation(oldValue, newValue) {
        this.renderCircle(oldValue, newValue);
    }

    lastAnimationId = 0;
    renderCircle(animateFrom, animateTo, ease = linearEase, animationDuration = 100, iterationCount = 0, dashLimit = 100) {
        if (this.isDestroyed || this.isDestroying || typeof FastBoot !== 'undefined') {
            return;
        }
    
        let id = ++this.lastAnimationId;
        let startTime = now();
        let changeInValue = animateTo - animateFrom;
        let diameter = this.diameter;
        let strokeWidth = this.strokeWidth;
        let rotation = -90 * iterationCount;
    
        let renderFrame = (value, diameter, strokeWidth, dashLimit) => {
            if (!this.isDestroyed && !this.isDestroying && this.element) {
    
            let path = this.element.querySelector('path');
            if (!path) {
                return;
            }
            path.setAttribute('stroke-dashoffset', this.getDashLength(diameter, strokeWidth, value, dashLimit));
            path.setAttribute('transform', `rotate(${rotation} ${diameter / 2} ${diameter / 2})`);
    
            }
        };
  
      // No need to animate it if the values are the same
      if (animateTo === animateFrom) {
        renderFrame(animateTo, diameter, strokeWidth, dashLimit);
      } else {
        let animation = () => {
          let currentTime = clamp(now() - startTime, 0, animationDuration);
          renderFrame(ease(currentTime, animateFrom, changeInValue, animationDuration), diameter, strokeWidth, dashLimit);
  
          // Do not allow overlapping animations
          if (id === this.lastAnimationId && currentTime < animationDuration) {
            this.lastDrawFrame = rAF(animation);
          }
  
          if (currentTime >= animationDuration && !this.args.value) {
            this.startIndeterminateAnimation();
          }
        };
        this.lastDrawFrame = rAF(animation);
      }
    }

    /**
     * Return stroke length for progress circle
     *
     * @param {number} diameter Diameter of the container.
     * @param {number} strokeWidth Stroke width to be used when drawing circle
     * @param {number} value Percentage of circle (between 0 and 100)
     * @param {number} limit Max percentage for circle
     *
     * @returns {number} Stroke length for progres circle
     */
    getDashLength(diameter, strokeWidth, value, limit) {
        return (diameter - strokeWidth) * Math.PI * ((3 * (limit || 100) / 100) - (value / 100));
    }

    @action
    startAnimation(element){
        this.element = element;
        if (!this.args.value) {
            this.startIndeterminateAnimation();
        }
    }

    @action
    stopAnimation(){
        if (this.lastDrawFrame) {
            cAF(this.lastDrawFrame);
        }
    }
}
