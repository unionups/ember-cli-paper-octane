import Component from '@glimmer/component';
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";

function getElementIndex(node) {
    let index = 0;
    while ((node = node.previousElementSibling)) {
    index++;
    }

    return index;
}

export default class SpeedDialComponent extends Component {
    @tracked open = this.args.isOpen;
    speedDial;

    
    get isOpen() {
        return this.args.isOpen ?? this.open;
    }

    get direction() {
        return this.args.direction ?? 'down';
    }

    get hoverEnabled() {
        return this.args.hoverEnabled ?? false;
    }

    @action
    mouseEnter() {
        if (this.hoverEnabled) {
            this.open = true;
        }
        this.effectClosed();
    }

    @action
    mouseLeave() {
        if (this.hoverEnabled) {
            this.open = false;
        }
        this.effectClosed();
    }

    @action
    click() {
        if (!this.hoverEnabled) {
            this.open = !this.open;
        }
        this.effectClosed();
        return false;
    }

    @action
    effectClosed() {
        let items = this.speedDial.querySelectorAll('.md-fab-action-item');
        if (this.args.fling) {
            let triggerElement = this.speedDial.querySelector('md-fab-trigger');
            items.forEach( element => {
                if (!this.open) {
                    let index = getElementIndex(element);

                    // Make sure to account for differences in the dimensions of the trigger verses the items
                    // so that we can properly center everything; this helps hide the el's shadows behind
                    // the trigger.
                    let triggerItemHeightOffset = (triggerElement.clientHeight - element.clientHeight) / 2;
                    let triggerItemWidthOffset = (triggerElement.clientWidth - element.clientWidth) / 2;

                    let newPosition, axis;

                    switch (this.direction) {
                    case 'up':
                        newPosition = (element.scrollHeight * (index + 1) + triggerItemHeightOffset);
                        axis = 'Y';
                        break;
                    case 'down':
                        newPosition = -(element.scrollHeight * (index + 1) + triggerItemHeightOffset);
                        axis = 'Y';
                        break;
                    case 'left':
                        newPosition = (element.scrollWidth * (index + 1) + triggerItemWidthOffset);
                        axis = 'X';
                        break;
                    case 'right':
                        newPosition = -(element.scrollWidth * (index + 1) + triggerItemWidthOffset);
                        axis = 'X';
                        break;
                    }

                    element.style.transform = `translate${axis}(${newPosition}px)`;
                } else {
                    element.style.transform = '';
                }

            })

        } else {
            
            items.forEach( element => {
                let index = getElementIndex(element);    
                let delay = 65;
                let offsetDelay = index * delay;
                let startZIndex = 0;
            
                element.style.opacity = this.open ? 1 : 0;
                element.style.transform = this.open ? 'scale(1)' : 'scale(0)';
                element.style.transitionDelay = `${this.open ? offsetDelay : (items.length * delay) - offsetDelay}ms`;
                element.style.zIndex =  (items.length - index) + startZIndex;
            })
        }
    }

    @action
    init(el) {
        this.speedDial = el;
        this.effectClosed();
        
    }
}