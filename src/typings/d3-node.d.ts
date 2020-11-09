declare module 'd3-node';
declare function D3Node({ d3Module, selector, container, styles, svgStyles, canvasModule }?: {
    d3Module?: any;
    selector?: string;
    container?: string;
    styles?: string;
    svgStyles?: string;
    canvasModule?: string;
}): D3Node;
declare class D3Node {
    constructor({ d3Module, selector, container, styles, svgStyles, canvasModule }?: {
        d3Module?: any;
        selector?: string;
        container?: string;
        styles?: string;
        svgStyles?: string;
        canvasModule?: string;
    });
    options: {
        d3Module: any;
        selector: string;
        container: string;
        styles: string;
        canvasModule: string;
    };
    document: any;
    window: any;
    d3Element: any;
    d3: any;
    createSVG(width: any, height: any, attrs?: any): any;
    createCanvas(width: any, height: any): any;
    svgString(): any;
    html(): any;
    chartHTML(): any;
}
declare namespace D3Node {
    export { d3, jsDom };
}
declare const d3: any;
declare const jsDom: any;