
module fgui {

    export class UIPackage {
        private _id: string;
        private _name: string;
        private _items: Array<PackageItem>;
        private _itemsById: any;
        private _itemsByName: any;
        private _resKey: string;
        private _customId: string;
        private _sprites: any;

        private _dependencies: Array<any>;
        private _branches: Array<string>;
        public _branchIndex: number;

        //internal
        public static _constructing: number = 0;

        private static _instById: any = {};
        private static _instByName: any = {};
        private static _branch: string = "";
        private static _vars: any = {};

        public constructor() {
            this._items = new Array<PackageItem>();
            this._itemsById = {};
            this._itemsByName = {};
            this._sprites = {};
            this._dependencies = Array<any>();
            this._branches = Array<string>();
            this._branchIndex = -1;
        }

        public static get branch(): string {
            return UIPackage._branch;
        }

        public static set branch(value: string) {
            UIPackage._branch = value;
            for (var pkgId in UIPackage._instById) {
                var pkg: UIPackage = UIPackage._instById[pkgId];
                if (pkg._branches) {
                    pkg._branchIndex = pkg._branches.indexOf(value);
                }
            }
        }

        public static getVar(key: string): any {
            return UIPackage._vars[key];
        }

        public static setVar(key: string, value: any) {
            UIPackage._vars[key] = value;
        }

        public static getById(id: string): UIPackage {
            return UIPackage._instById[id];
        }

        public static getByName(name: string): UIPackage {
            return UIPackage._instByName[name];
        }

        public static async loadPackage(resKey: string): Promise<UIPackage> {
            return new Promise<UIPackage>(async resolve => {
                let pkg: UIPackage = UIPackage._instById[resKey];
                if (pkg) {
                    resolve(pkg);
                    return;
                }

                const asset = await RES.getResAsync(resKey);
                pkg = new UIPackage();
                pkg._resKey = resKey;
                pkg.loadPackage(new ByteBuffer(asset));
                let cnt: number = pkg._items.length;
                let urls = [];
                for (var i: number = 0; i < cnt; i++) {
                    var pi: PackageItem = pkg._items[i];
                    if (pi.type == PackageItemType.Atlas || pi.type == PackageItemType.Sound)
                        urls.push(pi.file);
                }

                if (urls.length > 0) {
                    if (urls.length == 1)
                        await RES.getResAsync(urls[0]);
                    else {
                        let group: string = "$UI_" + resKey;
                        RES.createGroup(group, urls, true);
                        await RES.loadGroup(group);
                    }
                }

                UIPackage._instById[pkg.id] = pkg;
                UIPackage._instByName[pkg.name] = pkg;
                UIPackage._instById[pkg._resKey] = pkg;

                resolve(pkg);
            });
        }

        public static addPackage(resKey: string, descData?: ArrayBuffer): UIPackage {
            if (!descData) {
                descData = RES.getRes(resKey);
                if (!descData)
                    throw "Resource '" + resKey + "' not found, please check default.res.json!";
            }

            var pkg: UIPackage = new UIPackage();
            pkg._resKey = resKey;
            pkg.loadPackage(new ByteBuffer(descData));
            UIPackage._instById[pkg.id] = pkg;
            UIPackage._instByName[pkg.name] = pkg;
            UIPackage._instById[resKey] = pkg;
            return pkg;
        }

        public static removePackage(packageIdOrName: string): void {
            var pkg: UIPackage = UIPackage._instById[packageIdOrName];
            if (!pkg)
                pkg = UIPackage._instByName[packageIdOrName];
            if (!pkg)
                throw new Error("unknown package: " + packageIdOrName);

            pkg.dispose();
            delete UIPackage._instById[pkg.id];
            delete UIPackage._instByName[pkg.name];
            delete UIPackage._instById[pkg._resKey];
            if (pkg._customId != null)
                delete UIPackage._instById[pkg._customId];
        }

        public static createObject(pkgName: string, resName: string, userClass?: any): GObject {
            var pkg: UIPackage = UIPackage.getByName(pkgName);
            if (pkg)
                return pkg.createObject(resName, userClass);
            else
                return null;
        }

        public static createObjectFromURL(url: string, userClass?: any): GObject {
            var pi: PackageItem = UIPackage.getItemByURL(url);
            if (pi)
                return pi.owner.internalCreateObject(pi, userClass);
            else
                return null;
        }

        public static getItemURL(pkgName: string, resName: string): string {
            var pkg: UIPackage = UIPackage.getByName(pkgName);
            if (!pkg)
                return null;

            var pi: PackageItem = pkg._itemsByName[resName];
            if (!pi)
                return null;

            return "ui://" + pkg.id + pi.id;
        }

        public static getItemByURL(url: string): PackageItem {
            var pos1: number = url.indexOf("//");
            if (pos1 == -1)
                return null;

            var pos2: number = url.indexOf("/", pos1 + 2);
            if (pos2 == -1) {
                if (url.length > 13) {
                    var pkgId: string = url.substr(5, 8);
                    var pkg: UIPackage = UIPackage.getById(pkgId);
                    if (pkg != null) {
                        var srcId: string = url.substr(13);
                        return pkg.getItemById(srcId);
                    }
                }
            }
            else {
                var pkgName: string = url.substr(pos1 + 2, pos2 - pos1 - 2);
                pkg = UIPackage.getByName(pkgName);
                if (pkg != null) {
                    var srcName: string = url.substr(pos2 + 1);
                    return pkg.getItemByName(srcName);
                }
            }

            return null;
        }

        public static normalizeURL(url: string): string {
            if (url == null)
                return null;

            var pos1: number = url.indexOf("//");
            if (pos1 == -1)
                return null;

            var pos2: number = url.indexOf("/", pos1 + 2);
            if (pos2 == -1)
                return url;

            var pkgName: string = url.substr(pos1 + 2, pos2 - pos1 - 2);
            var srcName: string = url.substr(pos2 + 1);
            return UIPackage.getItemURL(pkgName, srcName);
        }

        public static setStringsSource(source: string): void {
            TranslationHelper.loadFromXML(source);
        }

        private loadPackage(buffer: ByteBuffer): void {
            if (buffer.readUnsignedInt() != 0x46475549)
                throw "FairyGUI: old package format found in '" + this._resKey + "'";

            buffer.version = buffer.readInt();
            var compressed: boolean = buffer.readBool();
            this._id = buffer.readUTF();
            this._name = buffer.readUTF();
            buffer.skip(20);

            if (compressed) {
                var buf: Uint8Array = new Uint8Array(buffer.buffer, buffer.position, buffer.length - buffer.position);
                var inflater: Zlib.RawInflate = new Zlib.RawInflate(buf);
                let buffer2: ByteBuffer = new ByteBuffer(inflater.decompress());
                buffer2.version = buffer.version;
                buffer = buffer2;
            }

            var ver2: boolean = buffer.version >= 2;
            var indexTablePos: number = buffer.position;
            var cnt: number;
            var i: number;
            var nextPos: number;
            var str: string;
            var branchIncluded: boolean;

            buffer.seek(indexTablePos, 4);

            cnt = buffer.readInt();
            var stringTable: Array<string> = new Array<string>(cnt);
            stringTable.reduceRight
            for (i = 0; i < cnt; i++)
                stringTable[i] = buffer.readUTF();
            buffer.stringTable = stringTable;

            buffer.seek(indexTablePos, 0);
            cnt = buffer.readShort();
            for (i = 0; i < cnt; i++)
                this._dependencies.push({ id: buffer.readS(), name: buffer.readS() });

            if (ver2) {
                cnt = buffer.readShort();
                if (cnt > 0) {
                    this._branches = buffer.readSArray(cnt);
                    if (UIPackage._branch)
                        this._branchIndex = this._branches.indexOf(UIPackage._branch);
                }

                branchIncluded = cnt > 0;
            }

            buffer.seek(indexTablePos, 1);

            var pi: PackageItem;
            var fileNamePrefix: string = this._resKey + "_";

            cnt = buffer.readShort();
            for (i = 0; i < cnt; i++) {
                nextPos = buffer.readInt();
                nextPos += buffer.position;

                pi = new PackageItem();
                pi.owner = this;
                pi.type = buffer.readByte();
                pi.id = buffer.readS();
                pi.name = buffer.readS();
                buffer.readS(); //path
                pi.file = buffer.readS();
                buffer.readBool();//exported
                pi.width = buffer.readInt();
                pi.height = buffer.readInt();

                switch (pi.type) {
                    case PackageItemType.Image:
                        {
                            pi.objectType = ObjectType.Image;
                            var scaleOption: number = buffer.readByte();
                            if (scaleOption == 1) {
                                pi.scale9Grid = new egret.Rectangle();
                                pi.scale9Grid.x = buffer.readInt();
                                pi.scale9Grid.y = buffer.readInt();
                                pi.scale9Grid.width = buffer.readInt();
                                pi.scale9Grid.height = buffer.readInt();

                                pi.tileGridIndice = buffer.readInt();
                            }
                            else if (scaleOption == 2)
                                pi.scaleByTile = true;

                            pi.smoothing = buffer.readBool();
                            break;
                        }

                    case PackageItemType.MovieClip:
                        {
                            pi.smoothing = buffer.readBool();
                            pi.objectType = ObjectType.MovieClip;
                            pi.rawData = buffer.readBuffer();
                            break;
                        }

                    case PackageItemType.Font:
                        {
                            pi.rawData = buffer.readBuffer();
                            break;
                        }

                    case PackageItemType.Component:
                        {
                            var extension: number = buffer.readByte();
                            if (extension > 0)
                                pi.objectType = extension;
                            else
                                pi.objectType = ObjectType.Component;
                            pi.rawData = buffer.readBuffer();

                            UIObjectFactory.resolvePackageItemExtension(pi);
                            break;
                        }

                    case PackageItemType.Atlas:
                    case PackageItemType.Sound:
                    case PackageItemType.Misc:
                        {
                            pi.file = fileNamePrefix + ToolSet.getFileName(pi.file);
                            break;
                        }
                }

                if (ver2) {
                    str = buffer.readS();//branch
                    if (str)
                        pi.name = str + "/" + pi.name;

                    var branchCnt: number = buffer.readUnsignedByte();
                    if (branchCnt > 0) {
                        if (branchIncluded)
                            pi.branches = buffer.readSArray(branchCnt);
                        else
                            this._itemsById[buffer.readS()] = pi;
                    }

                    var highResCnt: number = buffer.readUnsignedByte();
                    if (highResCnt > 0)
                        pi.highResolution = buffer.readSArray(highResCnt);
                }

                this._items.push(pi);
                this._itemsById[pi.id] = pi;
                if (pi.name != null)
                    this._itemsByName[pi.name] = pi;

                buffer.position = nextPos;
            }

            buffer.seek(indexTablePos, 2);

            cnt = buffer.readShort();
            for (i = 0; i < cnt; i++) {
                nextPos = buffer.readShort();
                nextPos += buffer.position;

                var itemId: string = buffer.readS();
                pi = this._itemsById[buffer.readS()];

                var sprite: AtlasSprite = new AtlasSprite();
                sprite.atlas = pi;
                sprite.rect.x = buffer.readInt();
                sprite.rect.y = buffer.readInt();
                sprite.rect.width = buffer.readInt();
                sprite.rect.height = buffer.readInt();
                sprite.rotated = buffer.readBool();
                if (ver2 && buffer.readBool()) {
                    sprite.offset.x = buffer.readInt();
                    sprite.offset.y = buffer.readInt();
                    sprite.originalSize.x = buffer.readInt();
                    sprite.originalSize.y = buffer.readInt();
                }
                else {
                    sprite.originalSize.x = sprite.rect.width;
                    sprite.originalSize.y = sprite.rect.height;
                }
                this._sprites[itemId] = sprite;

                buffer.position = nextPos;
            }

            if (buffer.seek(indexTablePos, 3)) {
                cnt = buffer.readShort();
                for (i = 0; i < cnt; i++) {
                    nextPos = buffer.readInt();
                    nextPos += buffer.position;

                    pi = this._itemsById[buffer.readS()];
                    if (pi && pi.type == PackageItemType.Image) {
                        pi.pixelHitTestData = new PixelHitTestData();
                        pi.pixelHitTestData.load(buffer);
                    }

                    buffer.position = nextPos;
                }
            }
        }

        public dispose(): void {
            var cnt: number = this._items.length;
            for (var i: number = 0; i < cnt; i++) {
                var pi: PackageItem = this._items[i];
                if (pi.type == PackageItemType.Atlas) {
                    RES.destroyRes(pi.file, false);
                }
                else if (pi.type == PackageItemType.Sound) {
                    //egret failed to do this
                    //RES.destroyRes(pi.file, false);
                }
            }
        }

        public get id(): string {
            return this._id;
        }

        public get name(): string {
            return this._name;
        }

        public get customId(): string {
            return this._customId;
        }

        public set customId(value: string) {
            if (this._customId != null)
                delete UIPackage._instById[this._customId];
            this._customId = value;
            if (this._customId != null)
                UIPackage._instById[this._customId] = this;
        }

        public createObject(resName: string, userClass?: any): GObject {
            var pi: PackageItem = this._itemsByName[resName];
            if (pi)
                return this.internalCreateObject(pi, userClass);
            else
                return null;
        }

        public internalCreateObject(item: PackageItem, userClass?: any): GObject {
            var g: GObject = UIObjectFactory.newObject(item, userClass);

            if (g == null)
                return null;

            UIPackage._constructing++;
            g.constructFromResource();
            UIPackage._constructing--;
            return g;
        }

        public getItemById(itemId: string): PackageItem {
            return this._itemsById[itemId];
        }

        public getItemByName(resName: string): PackageItem {
            return this._itemsByName[resName];
        }

        public getItemAssetByName(resName: string): any {
            var pi: PackageItem = this._itemsByName[resName];
            if (pi == null) {
                throw "Resource not found -" + resName;
            }

            return this.getItemAsset(pi);
        }

        public getItemAsset(item: PackageItem): any {
            switch (item.type) {
                case PackageItemType.Image:
                    if (!item.decoded) {
                        item.decoded = true;
                        var sprite: AtlasSprite = this._sprites[item.id];
                        if (sprite != null) {
                            var atlas: egret.Texture = <egret.Texture>this.getItemAsset(sprite.atlas);
                            item.texture = new egret.Texture();
                            item.texture.bitmapData = atlas.bitmapData;
                            item.texture.$initData(atlas.$bitmapX + sprite.rect.x, atlas.$bitmapY + sprite.rect.y,
                                sprite.rect.width, sprite.rect.height,
                                sprite.offset.x, sprite.offset.y,
                                sprite.originalSize.x, sprite.originalSize.y,
                                atlas.$sourceWidth, atlas.$sourceHeight,
                                sprite.rotated);
                        }
                    }
                    return item.texture;

                case PackageItemType.Atlas:
                    if (!item.decoded) {
                        item.decoded = true;
                        item.texture = RES.getRes(item.file);
                        if (!item.texture)
                            console.log("Resource '" + item.file + "' not found, please check default.res.json!");
                    }
                    return item.texture;

                case PackageItemType.Sound:
                    if (!item.decoded) {
                        item.decoded = true;
                        item.sound = RES.getRes(item.file);
                        if (!item.sound)
                            console.log("Resource '" + item.file + "' not found, please check default.res.json!");
                    }
                    return item.sound;

                case PackageItemType.Font:
                    if (!item.decoded) {
                        item.decoded = true;
                        this.loadFont(item);
                    }
                    return item.bitmapFont;

                case PackageItemType.MovieClip:
                    if (!item.decoded) {
                        item.decoded = true;
                        this.loadMovieClip(item);
                    }
                    return item.frames;

                case PackageItemType.Misc:
                    if (item.file)
                        return RES.getRes(item.file);
                    else
                        return null;

                default:
                    return null;
            }
        }

        private loadMovieClip(item: PackageItem): void {
            var buffer: ByteBuffer = item.rawData;

            buffer.seek(0, 0);

            item.interval = buffer.readInt();
            item.swing = buffer.readBool();
            item.repeatDelay = buffer.readInt();

            buffer.seek(0, 1);

            var frameCount: number = buffer.readShort();
            item.frames = Array<Frame>(frameCount);

            var spriteId: string;
            var frame: Frame;
            var sprite: AtlasSprite;
            var fx: number;
            var fy: number;

            for (var i: number = 0; i < frameCount; i++) {
                var nextPos: number = buffer.readShort();
                nextPos += buffer.position;

                frame = new Frame();
                fx = buffer.readInt();
                fy = buffer.readInt();
                buffer.readInt();//width
                buffer.readInt();//height
                frame.addDelay = buffer.readInt();
                spriteId = buffer.readS();

                if (spriteId != null && (sprite = this._sprites[spriteId]) != null) {
                    var atlas: egret.Texture = <egret.Texture>this.getItemAsset(sprite.atlas);
                    frame.texture = new egret.Texture();
                    frame.texture.bitmapData = atlas.bitmapData;
                    frame.texture.$initData(atlas.$bitmapX + sprite.rect.x, atlas.$bitmapY + sprite.rect.y,
                        sprite.rect.width, sprite.rect.height,
                        fx, fy,
                        item.width, item.height,
                        atlas.$sourceWidth, atlas.$sourceHeight, sprite.rotated);
                }
                item.frames[i] = frame;

                buffer.position = nextPos;
            }
        }

        private loadFont(item: PackageItem): void {
            var font: BitmapFont = new BitmapFont();
            item.bitmapFont = font;
            var buffer: ByteBuffer = item.rawData;

            buffer.seek(0, 0);

            font.ttf = buffer.readBool();
            font.tint = buffer.readBool();
            font.resizable = buffer.readBool();
            buffer.readBool(); //has channel
            font.size = buffer.readInt();
            var xadvance: number = buffer.readInt();
            var lineHeight: number = buffer.readInt();

            var mainTexture: egret.Texture = null;
            var mainSprite: AtlasSprite = this._sprites[item.id];
            if (mainSprite != null)
                mainTexture = <egret.Texture>(this.getItemAsset(mainSprite.atlas));

            buffer.seek(0, 1);

            var bg: BMGlyph = null;
            var cnt: number = buffer.readInt();
            for (var i: number = 0; i < cnt; i++) {
                var nextPos: number = buffer.readShort();
                nextPos += buffer.position;

                bg = new BMGlyph();
                var ch: string = buffer.readChar();
                font.glyphs[ch] = bg;

                var img: string = buffer.readS();
                var bx: number = buffer.readInt();
                var by: number = buffer.readInt();
                bg.x = buffer.readInt();
                bg.y = buffer.readInt();
                bg.width = buffer.readInt();
                bg.height = buffer.readInt();
                bg.advance = buffer.readInt();
                bg.channel = buffer.readByte();
                if (bg.channel == 1)
                    bg.channel = 3;
                else if (bg.channel == 2)
                    bg.channel = 2;
                else if (bg.channel == 3)
                    bg.channel = 1;

                if (font.ttf) {
                    bg.texture = new egret.Texture();
                    bg.texture.bitmapData = mainTexture.bitmapData;
                    bg.texture.$initData(mainTexture.$bitmapX + bx + mainSprite.rect.x, mainTexture.$bitmapY + by + mainSprite.rect.y,
                        bg.width, bg.height,
                        mainSprite.offset.x, mainSprite.offset.y,
                        mainSprite.originalSize.x, mainSprite.originalSize.y,
                        mainTexture.$sourceWidth, mainTexture.$sourceHeight,
                        mainSprite.rotated);

                    bg.lineHeight = lineHeight;
                }
                else {
                    var charImg: PackageItem = this._itemsById[img];
                    if (charImg) {
                        this.getItemAsset(charImg);
                        bg.width = charImg.width;
                        bg.height = charImg.height;
                        bg.texture = charImg.texture;
                    }

                    if (bg.advance == 0) {
                        if (xadvance == 0)
                            bg.advance = bg.x + bg.width;
                        else
                        
                            bg.advance = xadvance;
                    }

                    bg.lineHeight = bg.y < 0 ? bg.height : (bg.y + bg.height);
                    if (bg.lineHeight < font.size)
                        bg.lineHeight = font.size;
                }
                buffer.position = nextPos;
            }
        }
    }

    class AtlasSprite {
        public atlas: PackageItem;
        public rect: egret.Rectangle;
        public offset: egret.Point;
        public originalSize: egret.Point;
        public rotated: boolean;

        public constructor() {
            this.rect = new egret.Rectangle();
            this.offset = new egret.Point();
            this.originalSize = new egret.Point();
        }
    }
}