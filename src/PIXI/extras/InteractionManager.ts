

namespace PIXI.extras {
    export type InteractionCallback = (interactionEvent: InteractionEvent, displayObject: DisplayObject, hit?: boolean) => void;

    export class InteractionManager extends PIXI.InteractionManager {
        public stageRotation: number = 0;
        public stageScaleX: number = 1;
        public stageScaleY: number = 1;

        public constructor(renderer: PIXI.Renderer, options?: {
            autoPreventDefault?: boolean;
            interactionFrequency?: number;
            useSystemTicker?: number;
        }) {
            super(renderer, options);
        }

        search: any; // TreeSearch
        public delayedEvents: any[]; // []DelayedEvent

        // 这段和原版没区别，感觉不需要改
        // public processInteractive(interactionEvent: InteractionEvent, displayObject: DisplayObject,
        //     func?: InteractionCallback, hitTest?: boolean
        // ): void {
        //     const hit = this.search.findHit(interactionEvent, displayObject, func, hitTest);
        //     const delayedEvents = this.delayedEvents;
        //     if (!delayedEvents.length)
        //     {
        //         return hit;
        //     }
        //     // Reset the propagation hint, because we start deeper in the tree again.
        //     interactionEvent.stopPropagationHint = false;
        //     const delayedLen = delayedEvents.length;
        //     this.delayedEvents = [];
        //     for (let i = 0; i < delayedLen; i++) {
        //         const { displayObject, eventString, eventData } = delayedEvents[i];
        //         // When we reach the object we wanted to stop propagating at,
        //         // set the propagation hint.
        //         if (eventData.stopsPropagatingAt === displayObject)
        //         {
        //             eventData.stopPropagationHint = true;
        //         }
        //         (this as any).dispatchEvent(displayObject, eventString, eventData);
        //     }
        //     return hit;
        // }
   
        // 改成了pixi v7的样子
        public mapPositionToPoint(point: PIXI.Point, x: number, y: number): void {
            var rect = void 0;
            var dom = this.interactionDOMElement as any;
            if (!dom.parentElement) {
                rect = { 
                    x: 0, y: 0,
                    width: dom.width,
                    height: dom.height,
                    left: 0,
                    top: 0
                };
            } else {
                rect = dom.getBoundingClientRect();
            }
            const resolutionMultiplier = 1 / this.resolution;
            point.x = (x - rect.left) * (dom.width / rect.width) * resolutionMultiplier;
            point.y = (y - rect.top) * (dom.height / rect.height) * resolutionMultiplier;
        }

        // 这是旧版原本的样子
        // public mapPositionToPoint(point: PIXI.Point, x: number, y: number): void {
        //     let rect: any = void 0;
        //     let dom: any = this.interactionDOMElement;

        //     // IE 11 fix
        //     if (!dom.parentElement) {
        //         rect = { x: 0, y: 0, width: 0, height: 0 };
        //     } else {
        //         rect = dom.getBoundingClientRect();
        //     }

        //     let nav: any = navigator;
        //     // let resolutionMultiplier = nav.isCocoonJS ? this.resolution : 1.0 / this.resolution;
        //     // NOTE: 我没有遇到任何问题，所以直接改成1.0，反而是缩放后点击有偏移。微信待测试
        //     let resolutionMultiplier = 1.0;

        //     let doc = document.documentElement;
        //     let left: number = rect.left + window.pageXOffset - doc.clientLeft;
        //     let top: number = rect.top + window.pageYOffset - doc.clientTop;

        //     x -= left;
        //     y -= top;

        //     let newx = x, newy = y;
        //     if (this.stageRotation == 90) {
        //         newx = y;
        //         newy = rect.width - x;
        //     }
        //     else if (this.stageRotation == -90) {
        //         newx = rect.height - y;
        //         newy = x;
        //     }

        //     newx = newx * this.stageScaleX * resolutionMultiplier;
        //     newy = newy * this.stageScaleY * resolutionMultiplier;

        //     point.set(newx, newy);
        // }
    }
    PIXI.Renderer.registerPlugin("interaction", PIXI.extras.InteractionManager);
    // 新版写法，现在也不用了
    // (PIXI as any).extensions.add({
    //     name: 'interaction',
    //     type: 'renderer-webgl-plugin', // PIXI.ExtensionType.RendererPlugin,
    //     ref: PIXI.extras.InteractionManager,
    // });

    // PIXI.InteractionManager=PIXI.extras.InteractionManager;
    // //override
    // PIXI.CanvasRenderer.registerPlugin("interaction", PIXI.extras.InteractionManager);
    // PIXI.WebGLRenderer.registerPlugin("interaction", PIXI.extras.InteractionManager);
}
