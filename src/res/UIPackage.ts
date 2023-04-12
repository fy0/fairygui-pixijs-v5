namespace fgui {
    const fflate = (function () {
        // ../node_modules/fflate/esm/browser.js
        var u8 = Uint8Array;
        var u16 = Uint16Array;
        var u32 = Uint32Array;
    
        // fixed length extra bits
        const fleb = new u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, /* unused */ 0, 0, /* impossible */ 0]);
    
        // fixed distance extra bits
        // see fleb note
        const fdeb = new u8([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, /* unused */ 0, 0]);
    
        var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
        var freb = function (eb, start) {
            var b = new u16(31);
            for (var i = 0; i < 31; ++i) {
                b[i] = start += 1 << eb[i - 1];
            }
            var r = new u32(b[30]);
            for (var i = 1; i < 30; ++i) {
                for (var j = b[i]; j < b[i + 1]; ++j) {
                    r[j] = j - b[i] << 5 | i;
                }
            }
            return [b, r];
        };
        var _a = freb(fleb, 2);
        var fl = _a[0];
        var revfl = _a[1];
        fl[28] = 258, revfl[258] = 28;
        var _b = freb(fdeb, 0);
        var fd = _b[0];
        var revfd = _b[1];
        var rev = new u16(32768);
        for (i = 0; i < 32768; ++i) {
            x = (i & 43690) >>> 1 | (i & 21845) << 1;
            x = (x & 52428) >>> 2 | (x & 13107) << 2;
            x = (x & 61680) >>> 4 | (x & 3855) << 4;
            rev[i] = ((x & 65280) >>> 8 | (x & 255) << 8) >>> 1;
        }
        var x;
        var i;
        var hMap = function (cd, mb, r) {
            var s = cd.length;
            var i = 0;
            var l = new u16(mb);
            for (; i < s; ++i) {
                if (cd[i])
                    ++l[cd[i] - 1];
            }
            var le = new u16(mb);
            for (i = 0; i < mb; ++i) {
                le[i] = le[i - 1] + l[i - 1] << 1;
            }
            var co;
            if (r) {
                co = new u16(1 << mb);
                var rvb = 15 - mb;
                for (i = 0; i < s; ++i) {
                    if (cd[i]) {
                        var sv = i << 4 | cd[i];
                        var r_1 = mb - cd[i];
                        var v = le[cd[i] - 1]++ << r_1;
                        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
                            co[rev[v] >>> rvb] = sv;
                        }
                    }
                }
            } else {
                co = new u16(s);
                for (i = 0; i < s; ++i) {
                    if (cd[i]) {
                        co[i] = rev[le[cd[i] - 1]++] >>> 15 - cd[i];
                    }
                }
            }
            return co;
        };
        var flt = new u8(288);
        for (i = 0; i < 144; ++i)
            flt[i] = 8;
        var i;
        for (i = 144; i < 256; ++i)
            flt[i] = 9;
        var i;
        for (i = 256; i < 280; ++i)
            flt[i] = 7;
        var i;
        for (i = 280; i < 288; ++i)
            flt[i] = 8;
        var i;
        var fdt = new u8(32);
        for (i = 0; i < 32; ++i)
            fdt[i] = 5;
        var i;
        var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
        var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
        var max = function (a) {
            var m = a[0];
            for (var i = 1; i < a.length; ++i) {
                if (a[i] > m)
                    m = a[i];
            }
            return m;
        };
        var bits = function (d, p, m) {
            var o = p / 8 | 0;
            return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
        };
        var bits16 = function (d, p) {
            var o = p / 8 | 0;
            return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
        };
        var shft = function (p) {
            return (p + 7) / 8 | 0;
        };
        var slc = function (v, s, e) {
            if (s == null || s < 0)
                s = 0;
            if (e == null || e > v.length)
                e = v.length;
            var n = new (v.BYTES_PER_ELEMENT == 2 ? u16 : v.BYTES_PER_ELEMENT == 4 ? u32 : u8)(e - s);
            n.set(v.subarray(s, e));
            return n;
        };
        var ec = [
            "unexpected EOF",
            "invalid block type",
            "invalid length/literal",
            "invalid distance",
            "stream finished",
            "no stream handler",
            ,
            "no callback",
            "invalid UTF-8 data",
            "extra field too long",
            "date not in range 1980-2099",
            "filename too long",
            "stream finishing",
            "invalid zip data"
            // determined by unknown compression method
        ];
    
        /**
         * An error generated within this library
         */
        interface FlateError extends Error {
            /**
             * The code associated with this error
             */
            code: number;
        };
        // inflate state
        type InflateState = {
            // lmap
            l?: Uint16Array;
            // dmap
            d?: Uint16Array;
            // lbits
            m?: number;
            // dbits
            n?: number;
            // final
            f?: number;
            // pos
            p?: number;
            // byte
            b?: number;
            // lstchk
            i?: boolean;
        };
    
        const err = (ind: number, msg?: string | 0, nt?: 1) => {
            const e: Partial<FlateError> = new Error(msg || ec[ind]);
            e.code = ind;
            if ((Error as any).captureStackTrace) (Error as any).captureStackTrace(e, err);
            if (!nt) throw e;
            return e as FlateError;
        }
    
        // expands raw DEFLATE data
        const inflt = (dat: Uint8Array, buf?: Uint8Array, st?: InflateState) => {
            // source length
            const sl = dat.length;
            if (!sl || (st && st.f && !st.l)) return buf || new u8(0);
            // have to estimate size
            const noBuf = !buf || (st as any as boolean);
            // no state
            const noSt = !st || st.i;
            if (!st) st = {};
            // Assumes roughly 33% compression ratio average
            if (!buf) buf = new u8(sl * 3);
            // ensure buffer can fit at least l elements
            const cbuf = (l: number) => {
                let bl = buf.length;
                // need to increase size to fit
                if (l > bl) {
                    // Double or set to necessary, whichever is greater
                    const nbuf = new u8(Math.max(bl * 2, l));
                    nbuf.set(buf);
                    buf = nbuf;
                }
            };
            //  last chunk         bitpos           bytes
            let final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
            // total bits
            const tbts = sl * 8;
            do {
                if (!lm) {
                    // BFINAL - this is only 1 when last chunk is next
                    final = bits(dat, pos, 1);
                    // type: 0 = no compression, 1 = fixed huffman, 2 = dynamic huffman
                    const type = bits(dat, pos + 1, 3);
                    pos += 3;
                    if (!type) {
                        // go to end of byte boundary
                        const s = shft(pos) + 4, l = dat[s - 4] | (dat[s - 3] << 8), t = s + l;
                        if (t > sl) {
                            if (noSt) err(0);
                            break;
                        }
                        // ensure size
                        if (noBuf) cbuf(bt + l);
                        // Copy over uncompressed data
                        buf.set(dat.subarray(s, t), bt);
                        // Get new bitpos, update byte count
                        st.b = bt += l, st.p = pos = t * 8, st.f = final;
                        continue;
                    }
                    else if (type == 1) lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
                    else if (type == 2) {
                        //  literal                            lengths
                        const hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
                        const tl = hLit + bits(dat, pos + 5, 31) + 1;
                        pos += 14;
                        // length+distance tree
                        const ldt = new u8(tl);
                        // code length tree
                        const clt = new u8(19);
                        for (let i = 0; i < hcLen; ++i) {
                            // use index map to get real code
                            clt[clim[i]] = bits(dat, pos + i * 3, 7);
                        }
                        pos += hcLen * 3;
                        // code lengths bits
                        const clb = max(clt), clbmsk = (1 << clb) - 1;
                        // code lengths map
                        const clm = hMap(clt, clb, 1);
                        for (let i = 0; i < tl;) {
                            const r = clm[bits(dat, pos, clbmsk)];
                            // bits read
                            pos += r & 15;
                            // symbol
                            const s = r >>> 4;
                            // code length to copy
                            if (s < 16) {
                                ldt[i++] = s;
                            } else {
                                //  copy   count
                                let c = 0, n = 0;
                                if (s == 16) n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
                                else if (s == 17) n = 3 + bits(dat, pos, 7), pos += 3;
                                else if (s == 18) n = 11 + bits(dat, pos, 127), pos += 7;
                                while (n--) ldt[i++] = c;
                            }
                        }
                        //    length tree                 distance tree
                        const lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
                        // max length bits
                        lbt = max(lt)
                        // max dist bits
                        dbt = max(dt);
                        lm = hMap(lt, lbt, 1);
                        dm = hMap(dt, dbt, 1);
                    } else err(1);
                    if (pos > tbts) {
                        if (noSt) err(0);
                        break;
                    }
                }
                // Make sure the buffer can hold this + the largest possible addition
                // Maximum chunk size (practically, theoretically infinite) is 2^17;
                if (noBuf) cbuf(bt + 131072);
                const lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
                let lpos = pos;
                for (; ; lpos = pos) {
                    // bits read, code
                    const c = lm[bits16(dat, pos) & lms], sym = c >>> 4;
                    pos += c & 15;
                    if (pos > tbts) {
                        if (noSt) err(0);
                        break;
                    }
                    if (!c) err(2);
                    if (sym < 256) buf[bt++] = sym;
                    else if (sym == 256) {
                        lpos = pos, lm = null;
                        break;
                    } else {
                        let add = sym - 254;
                        // no extra bits needed if less
                        if (sym > 264) {
                            // index
                            const i = sym - 257, b = fleb[i];
                            add = bits(dat, pos, (1 << b) - 1) + fl[i];
                            pos += b;
                        }
                        // dist
                        const d = dm[bits16(dat, pos) & dms], dsym = d >>> 4;
                        if (!d) err(3);
                        pos += d & 15;
                        let dt = fd[dsym];
                        if (dsym > 3) {
                            const b = fdeb[dsym];
                            dt += bits16(dat, pos) & ((1 << b) - 1), pos += b;
                        }
                        if (pos > tbts) {
                            if (noSt) err(0);
                            break;
                        }
                        if (noBuf) cbuf(bt + 131072);
                        const end = bt + add;
                        for (; bt < end; bt += 4) {
                            buf[bt] = buf[bt - dt];
                            buf[bt + 1] = buf[bt + 1 - dt];
                            buf[bt + 2] = buf[bt + 2 - dt];
                            buf[bt + 3] = buf[bt + 3 - dt];
                        }
                        bt = end;
                    }
                }
                st.l = lm, st.p = lpos, st.b = bt, st.f = final;
                if (lm) final = 1, st.m = lbt, st.d = dm, st.n = dbt;
            } while (!final)
            return bt == buf.length ? buf : slc(buf, 0, bt);
        }
    
        var et = /* @__PURE__ */ new u8(0);
        function inflateSync(data: Uint8Array, out?: Uint8Array): Uint8Array {
            return inflt(data, out) as any;
        }
        var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
        var tds = 0;
        try {
            td.decode(et, { stream: true });
            tds = 1;
        } catch (e) {
        }
    
        // a.ts
        return {
            inflateSync
        };
    })();

    export type AssetTypes = PIXI.Texture | BitmapFont | Frame[] | utils.XmlNode | PIXI.LoaderResource;

    type UIPackageDictionary = {
        [key: string]: UIPackage
    }

    type PackageItemDictionary = {
        [key: string]: PackageItem
    }

    type BitmapFontDictionary = {
        [key: string]: BitmapFont
    }

    type ResDataDictionary = {
        [key: string]: string
    }

    class AtlasConfig {
        public atlasName: string;
        public texCacheID: string;
        public frame: PIXI.Rectangle;
        public orig: PIXI.Rectangle;
        public trim: PIXI.Rectangle;
        public rotate: number;
        
        public constructor(atlasName:string, frame?:PIXI.Rectangle, orig?:PIXI.Rectangle, trim?:PIXI.Rectangle, rotate?:number) {
            this.atlasName = atlasName;
            this.frame = frame;
            this.orig = orig;
            this.trim = trim;
            this.rotate = rotate;
        }
    }

    type AtlasDictionary = {
        [key: string]: AtlasConfig
    }

    type StringSource = {
        [key: string]: string
    }
    type StringSourceMap = {
        [key: string]: StringSource
    }

    export class UIPackage {
        private $id: string;
        private $name: string;
        private $resKey: string;

        private $items: PackageItem[];
        private $itemsById: PackageItemDictionary;
        private $itemsByName: PackageItemDictionary;

        private $resData: ResDataDictionary;
        private $customId: string;
        private $atlasConfigs: AtlasDictionary;

        /**@internal */
        static $constructingObjects: number = 0;

        private static $packageInstById: UIPackageDictionary = {};
        private static $packageInstByName: UIPackageDictionary = {};
        private static $bitmapFonts: BitmapFontDictionary = {};

        private static $stringsSource: StringSourceMap = null;

        private static sep0: string = ",";
        private static sep1: string = "\n";
        private static sep2: string = " ";
        private static sep3: string = "=";

        public constructor() {
            this.$items = [];
            this.$atlasConfigs = {};
        }

        public static getById(id: string): UIPackage {
            return UIPackage.$packageInstById[id];
        }

        public static getByName(name: string): UIPackage {
            return UIPackage.$packageInstByName[name];
        }

        public static addPackage(resKey: string): UIPackage {
            let pkg: UIPackage = new UIPackage();
            pkg.create(resKey);
            UIPackage.$packageInstById[pkg.id] = pkg;
            UIPackage.$packageInstByName[pkg.name] = pkg;
            pkg.customId = resKey;
            return pkg;
        }

        public static removePackage(packageId: string): void {
            let pkg: UIPackage = UIPackage.$packageInstById[packageId];
            pkg.dispose();
            delete UIPackage.$packageInstById[pkg.id];
            if (pkg.$customId != null)
                delete UIPackage.$packageInstById[pkg.$customId];
            delete UIPackage.$packageInstByName[pkg.name];
        }

        public static createObject(pkgName: string, resName: string, userClass?: { new():GObject }): GObject {
            let pkg: UIPackage = UIPackage.getByName(pkgName);
            if (pkg)
                return pkg.createObject(resName, userClass);
            else
                return null;
        }

        public static createObjectFromURL(url: string, userClass?: { new():GObject }): GObject {
            let pi: PackageItem = UIPackage.getItemByURL(url);
            if (pi)
                return pi.owner.internalCreateObject(pi, userClass);
            else
                return null;
        }

        public static getItemURL(pkgName: string, resName: string): string {
            let pkg: UIPackage = UIPackage.getByName(pkgName);
            if (!pkg)
                return null;

            let pi: PackageItem = pkg.$itemsByName[resName];
            if (!pi)
                return null;

            return `ui://${pkg.id}${pi.id}`;
        }

        public static getItemByURL(url: string): PackageItem {
            let pos1: number = url.indexOf("//");
            if (pos1 == -1)
                return null;

            let pos2: number = url.indexOf("/", pos1 + 2);
            let pkg: UIPackage;
            if (pos2 == -1) {
                if (url.length > 13) {
                    let pkgId: string = url.substr(5, 8);
                    pkg = UIPackage.getById(pkgId);
                    if (pkg != null) {
                        let srcId: string = url.substr(13);
                        return pkg.getItemById(srcId);
                    }
                }
            }
            else {
                let pkgName: string = url.substr(pos1 + 2, pos2 - pos1 - 2);
                pkg = UIPackage.getByName(pkgName);
                if (pkg != null) {
                    let srcName: string = url.substr(pos2 + 1);
                    return pkg.getItemByName(srcName);
                }
            }

            return null;
        }

        public static getBitmapFontByURL(url: string): BitmapFont {
            return UIPackage.$bitmapFonts[url];
        }

        public static setStringsSource(source: string): void {
            UIPackage.$stringsSource = {};
            let xmlroot: utils.XmlNode = utils.XmlParser.tryParse(source);
            xmlroot.children.forEach(cxml => {
                if (cxml.nodeName == "string") {
                    let key: string = cxml.attributes.name;
                    let i: number = key.indexOf("-");
                    if (i == -1) return;

                    let text: string = cxml.children.length > 0 ? cxml.children[0].text : "";

                    let key2: string = key.substr(0, i);
                    let key3: string = key.substr(i + 1);
                    let col: StringSource = UIPackage.$stringsSource[key2];
                    if (!col) {
                        col = {};
                        UIPackage.$stringsSource[key2] = col;
                    }
                    col[key3] = text;
                }
            });
        }

        /**
         * format the URL from old version to new version
         * @param url url with old version format
         */
        public static normalizeURL(url: string): string {
            if (url == null)
                return null;

            let pos1: number = url.indexOf("//");
            if (pos1 == -1)
                return null;

            let pos2: number = url.indexOf("/", pos1 + 2);
            if (pos2 == -1)
                return url;

            let pkgName: string = url.substr(pos1 + 2, pos2 - pos1 - 2);
            let srcName: string = url.substr(pos2 + 1);
            return UIPackage.getItemURL(pkgName, srcName);
        }

        private create(resKey: string): void {
            this.$resKey = resKey;

            let buf: PIXI.LoaderResource = utils.AssetLoader.resourcesPool[this.$resKey];
            if (!buf)
                buf = utils.AssetLoader.resourcesPool[`${this.$resKey}_fui`];
            if (!buf)
                throw new Error(`Resource '${this.$resKey}' not found, please make sure that you use "new fgui.utils.AssetLoader" to load resources instead of " PIXI.loaders.Loader".`);

            if (!buf.data || !(buf.data instanceof ArrayBuffer))
                throw new Error(`Resource '${this.$resKey}' is not a proper binary resource, please load it as binary format by calling yourLoader.add(name, url, { loadType:PIXI.loaders.Resource.LOAD_TYPE.XHR, xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.BUFFER })`);

            this.decompressPackage(buf.data);

            let str = this.getResDescriptor("sprites.bytes");
            str && str.split(UIPackage.sep1).forEach((str, index) => {
                if(index >= 1 && str && str.length) {
                    let arr: string[] = str.split(UIPackage.sep2);

                    let texID: string;
                    let itemId: string = arr[0];
                    let binIndex: number = parseInt(arr[1]);
                    if (binIndex >= 0)
                        texID = `atlas${binIndex}`;
                    else
                    {
                        let pos: number = itemId.indexOf("_");
                        if (pos == -1)
                            texID = `atlas_${itemId}`;
                        else
                            texID = `atlas_${itemId.substr(0, pos)}`;
                    }

                    let cfg: AtlasConfig = new AtlasConfig(texID);
                    cfg.frame = new PIXI.Rectangle(parseInt(arr[2]), parseInt(arr[3]), parseInt(arr[4]), parseInt(arr[5]));
                    cfg.rotate = arr[6] == "1" ? 6 : 0;   //refer to PIXI.GroupD8, the editors rotate image by -90deg
                    cfg.orig = cfg.rotate != 0 ? new PIXI.Rectangle(0, 0, cfg.frame.height, cfg.frame.width) : null;
                    /*
                    cfg.trim = trimed;  //ignored for now - editor not support
                    */
                    this.$atlasConfigs[itemId] = cfg;
                }
            });
            
            str = this.getResDescriptor("package.xml");
            let xml: utils.XmlNode = utils.XmlParser.tryParse(str);

            this.$id = xml.attributes.id;
            this.$name = xml.attributes.name;

            let resources: utils.XmlNode[] = xml.children[0].children;

            this.$itemsById = {};
            this.$itemsByName = {};
            
            resources.forEach(cxml => {
                let pi = new PackageItem();
                pi.type = ParsePackageItemType(cxml.nodeName);
                pi.id = cxml.attributes.id;
                pi.name = cxml.attributes.name;
                pi.file = cxml.attributes.file;
                str = cxml.attributes.size;
                if (str) {
                    let arr = str.split(UIPackage.sep0);
                    pi.width = parseInt(arr[0]);
                    pi.height = parseInt(arr[1]);
                }
                switch (pi.type) {
                    case PackageItemType.Image: {
                        str = cxml.attributes.scale;
                        if (str == "9grid") {
                            str = cxml.attributes.scale9grid;
                            if (str) {
                                let arr = str.split(UIPackage.sep0);
                                let rect = new PIXI.Rectangle(
                                    parseInt(arr[0]),
                                    parseInt(arr[1]),
                                    parseInt(arr[2]),
                                    parseInt(arr[3])
                                );
                                pi.scale9Grid = rect;

                                str = cxml.attributes.gridTile;
                                if (str)
                                    pi.tiledSlices = parseInt(str);
                            }
                        }
                        else if (str == "tile")
                            pi.scaleByTile = true;

                        break;
                    }
                }

                pi.owner = this;
                this.$items.push(pi);
                this.$itemsById[pi.id] = pi;
                if (pi.name != null)
                    this.$itemsByName[pi.name] = pi;
            }, this);
            
            this.$items.forEach(pi => {
                if (pi.type == PackageItemType.Font) {
                    this.loadFont(pi);
                    UIPackage.$bitmapFonts[pi.bitmapFont.id] = pi.bitmapFont;
                }
            }, this);
        }

        private decompressPackage(buf: ArrayBuffer): void {
            this.$resData = {};

            // let inflater: Zlib.RawInflate = new Zlib.RawInflate(buf);
            // let data: Uint8Array = inflater.decompress();
            var data = fflate.inflateSync(new Uint8Array(buf));
            let source: string = utils.RawByte.decodeUTF8(data);
            let curr: number = 0;
            let fn: string;
            let size: number;
            while (true) {
                let pos: number = source.indexOf("|", curr);
                if (pos == -1)
                    break;
                fn = source.substring(curr, pos);
                curr = pos + 1;
                pos = source.indexOf("|", curr);
                size = parseInt(source.substring(curr, pos));
                curr = pos + 1;
                this.$resData[fn] = source.substr(curr, size);
                curr += size;
            }
        }

        public dispose(): void {
            this.$items.forEach(pi => {
                let texture: PIXI.Texture = pi.texture;
                if (texture != null) {
                    texture.destroy();
                    //texture.baseTexture.destroy();
                    PIXI.Texture.removeFromCache(texture);
                }
                else if (pi.frames != null) {
                    pi.frames.forEach(f => {
                        texture = f.texture;
                        if(texture) {
                            texture.destroy();
                            //texture.baseTexture.destroy();
                            PIXI.Texture.removeFromCache(texture);
                        }
                    });
                }
                else if (pi.bitmapFont != null)
                    delete UIPackage.$bitmapFonts[pi.bitmapFont.id];
                    
                let cfg = this.$atlasConfigs[pi.id];
                if(cfg)
                    utils.AssetLoader.destroyResource(`${this.$resKey}@${cfg.atlasName}`);
            }, this);

            utils.AssetLoader.destroyResource(`${this.$resKey}`);
        }

        public get id(): string {
            return this.$id;
        }

        public get name(): string {
            return this.$name;
        }

        public get customId(): string {
            return this.$customId;
        }

        public set customId(value: string) {
            if (this.$customId != null)
                delete UIPackage.$packageInstById[this.$customId];
            this.$customId = value;
            if (this.$customId != null)
                UIPackage.$packageInstById[this.$customId] = this;
        }

        public createObject(resName: string, userClass?: { new():GObject }): GObject {
            let pi: PackageItem = this.$itemsByName[resName];
            if (pi)
                return this.internalCreateObject(pi, userClass);
            else
                return null;
        }

        public internalCreateObject(item: PackageItem, userClass: { new(): GObject; } = null): GObject {
            let g: GObject = item.type == PackageItemType.Component && userClass != null ? new userClass() : UIObjectFactory.newObject(item);
            if (g == null)
                return null;

            UIPackage.$constructingObjects++;
            g.packageItem = item;
            g.constructFromResource();
            UIPackage.$constructingObjects--;
            return g;
        }

        public getItemById(itemId: string): PackageItem {
            return this.$itemsById[itemId];
        }

        public getItemByName(resName: string): PackageItem {
            return this.$itemsByName[resName];
        }

        public getItemAssetByName(resName: string): AssetTypes {
            let pi: PackageItem = this.$itemsByName[resName];
            if (pi == null)
                throw new Error(`Resource '${resName}' not found`);
            return this.getItemAsset(pi);
        }

        private createSpriteTexture(cfgName:string, cfg: AtlasConfig): PIXI.Texture {
            let atlasItem: PackageItem = this.$itemsById[cfg.atlasName];
            if (atlasItem != null) {
                let atlasTexture: PIXI.Texture = this.getItemAsset(atlasItem) as PIXI.Texture;
                if (!atlasTexture || !atlasTexture.baseTexture) return null;
                if(!cfg.texCacheID)
                    cfg.texCacheID = `${this.$resKey}@${cfg.atlasName}@${cfgName}`;

                let tex = PIXI.utils.TextureCache[cfg.texCacheID];
                if(!tex) {
                    tex = new PIXI.Texture(atlasTexture.baseTexture, cfg.frame, cfg.orig, cfg.trim, cfg.rotate);
                    PIXI.Texture.addToCache(tex, cfg.texCacheID);
                }
                return tex;
            }
            else
                return null;
        }

        public getItemAsset(item: PackageItem): AssetTypes {
            switch (item.type) {
                case PackageItemType.Image:
                    if (!item.decoded) {
                        item.decoded = true;
                        let cfg: AtlasConfig = this.$atlasConfigs[item.id];
                        if (cfg != null)
                            item.texture = this.createSpriteTexture(item.id, cfg);
                    }
                    return item.texture;

                case PackageItemType.Atlas:
                    if (!item.decoded) {
                        item.decoded = true;
                        let fileName: string = (item.file != null && item.file.length > 0) ? item.file : (`${item.id}.png`);
                        let resName: string = `${this.$resKey}@${utils.StringUtil.getFileName(fileName)}`;
                        let res: PIXI.LoaderResource= utils.AssetLoader.resourcesPool[resName];
                        if (!res) throw new Error(`${resName} not found in fgui.utils.AssetLoader.resourcesPool, please use new AssetLoader() to load assets instead of using new PIXI.loaders.Loader(). besides, AssetLoader is a sub-class from PIXI.loaders.Loader so they have the same usage.`);
                        item.texture = res.texture;
                        if (!item.texture) {
                            res = utils.AssetLoader.resourcesPool[`${this.$resKey}@${fileName.replace("\.", "_")}`];
                            item.texture = res.texture;
                        }
                    }
                    return item.texture;

                case PackageItemType.Sound:   //ignored, maybe integrate with PIXI.Sound
                    item.decoded = false;
                    return null;

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

                case PackageItemType.Component:
                    if (!item.decoded) {
                        item.decoded = true;
                        let str: string = this.getResDescriptor(`${item.id}.xml`);
                        let xml: utils.XmlNode = utils.XmlParser.tryParse(str);
                        item.componentData = xml;
                        this.loadComponentChildren(item);
                        this.loadComponentTranslation(item);
                    }
                    return item.componentData;

                default:
                    return utils.AssetLoader.resourcesPool[`${this.$resKey}@${item.id}`];
            }
        }

        private loadComponentChildren(item: PackageItem): void {
            let listNode: utils.XmlNode[] = utils.XmlParser.getChildNodes(item.componentData, "displayList");
            if (listNode != null && listNode.length > 0) {
                item.displayList = [];
                listNode[0].children.forEach(cxml => {
                    let tagName: string = cxml.nodeName;
                    let di: DisplayListItem;
                    let src: string = cxml.attributes.src;
                    if (src) {
                        let pkgId: string = cxml.attributes.pkg;
                        let pkg: UIPackage;
                        if (pkgId && pkgId != item.owner.id)
                            pkg = UIPackage.getById(pkgId);
                        else
                            pkg = item.owner;

                        let pi: PackageItem = pkg != null ? pkg.getItemById(src) : null;
                        if (pi != null)
                            di = new DisplayListItem(pi, null);
                        else
                            di = new DisplayListItem(null, tagName);
                    }
                    else {
                        if (tagName == "text" && cxml.attributes.input == "true")
                            di = new DisplayListItem(null, "inputtext");
                        else
                            di = new DisplayListItem(null, tagName);
                    }

                    di.desc = cxml;
                    item.displayList.push(di);
                });
            }
            else
                item.displayList = [];
        }

        private getResDescriptor(fn: string): string {
            return this.$resData[fn];
        }

        private loadComponentTranslation(item: PackageItem): void {
            if (UIPackage.$stringsSource == null)
                return;

            let strings: StringSource = UIPackage.$stringsSource[this.id + item.id];
            if (strings == null)
                return;

            let value: string;
            let cxml: utils.XmlNode, dxml: utils.XmlNode;
            let ename: string;
            let elementId: string;
            let str: string;

            item.displayList.forEach(item => {

                cxml = item.desc;
                ename = cxml.nodeName;
                elementId = cxml.attributes.id;

                str = cxml.attributes.tooltips;
                if (str) {
                    value = strings[`${elementId}-tips`];
                    if (value != undefined)
                        cxml.attributes.tooltips = value;
                }

                let cs: utils.XmlNode[] = utils.XmlParser.getChildNodes(cxml, "gearText");
                dxml = cs && cs[0];
                if (dxml) {
                    value = strings[`${elementId}-texts`];
                    if (value != undefined)
                        dxml.attributes.values = value;

                    value = strings[`${elementId}-texts_def`];
                    if (value != undefined)
                        dxml.attributes.default = value;
                }

                if (ename == "text" || ename == "richtext") {
                    value = strings[elementId];
                    if (value != undefined)
                        cxml.attributes.text = value;
                    value = strings[`${elementId}-prompt`];
                    if (value != undefined)
                        cxml.attributes.prompt = value;
                }
                else if (ename == "list") {
                    cxml.children.forEach((exml, index) => {
                        if (exml.nodeName != "item")
                            return;
                        value = strings[`${elementId}-${index}`];
                        if (value != undefined)
                            exml.attributes.title = value;
                    });
                }
                else if (ename == "component") {
                    cs = utils.XmlParser.getChildNodes(cxml, "Button");
                    dxml = cs && cs[0];
                    if (dxml) {
                        value = strings[elementId];
                        if (value != undefined)
                            dxml.attributes.title = value;
                        value = strings[`${elementId}-0`];
                        if (value != undefined)
                            dxml.attributes.selectedTitle = value;
                        return;
                    }

                    cs = utils.XmlParser.getChildNodes(cxml, "Label");
                    dxml = cs && cs[0];
                    if (dxml) {
                        value = strings[elementId];
                        if (value != undefined)
                            dxml.attributes.title = value;
                        return;
                    }

                    cs = utils.XmlParser.getChildNodes(cxml, "ComboBox");
                    dxml = cs && cs[0];
                    if (dxml) {
                        value = strings[elementId];
                        if (value != undefined)
                            dxml.attributes.title = value;

                        dxml.children.forEach((exml, index) => {
                            if (exml.nodeName != "item")
                                return;
                            value = strings[`${elementId}-${index}`];
                            if (value != undefined)
                                exml.attributes.title = value;
                        });
                        return;
                    }
                }
            });
        }

        private loadMovieClip(item: PackageItem): void {
            let xml: utils.XmlNode = utils.XmlParser.tryParse(this.getResDescriptor(`${item.id}.xml`));
            let str: string;
            
            str = xml.attributes.interval;
            if (str != null)
                item.interval = parseInt(str);
            str = xml.attributes.swing;
            if (str != null)
                item.swing = str == "true";
            str = xml.attributes.repeatDelay;
            if (str != null)
                item.repeatDelay = parseInt(str);

            item.frames = [];
            let frameNodes: utils.XmlNode[] = xml.children[0].children;
            frameNodes.forEach((node, index) => {
                let frame: Frame = new Frame();
                str = node.attributes.rect;
                let arr = str.split(UIPackage.sep0);
                let trimRect: PIXI.Rectangle = new PIXI.Rectangle(parseInt(arr[0]), parseInt(arr[1]), parseInt(arr[2]), parseInt(arr[3]));
                str = node.attributes.addDelay;
                if (str)
                    frame.addDelay = parseInt(str);
                item.frames.push(frame);
                if (trimRect.width <= 0)
                    return;
                str = node.attributes.sprite;
                if (str)
                    str = `${item.id}_${str}`;
                else
                    str = `${item.id}_${index}`;
                let cfg: AtlasConfig = this.$atlasConfigs[str];
                if(cfg != null) {
                    cfg.trim = trimRect;
                    frame.texture = this.createSpriteTexture(str, cfg);
                }
            });
        }

        private loadFont(item: PackageItem): void {
            let font: BitmapFont = new BitmapFont();
            font.id = `ui://${this.id}${item.id}`;
            let str: string = this.getResDescriptor(`${item.id}.fnt`);

            let lines: string[] = str.split(UIPackage.sep1);
            
            let kv: { [key: string]: string } = {};
            let ttf: boolean = false;
            let size: number = 0;
            let xadvance: number = 0;
            let resizable: boolean = false;
            let colorable: boolean = false;
            let atlasOffsetX: number = 0, atlasOffsetY: number = 0;
            let charImg: PackageItem;
            let mainTexture: PIXI.Texture;
            let lineHeight: number = 0;
            let maxCharHeight:number = 0;

            lines.forEach(line => {
                if(line && line.length) {
                    str = utils.StringUtil.trim(line);
                    let arr: string[] = str.split(UIPackage.sep2);
                    arr.forEach(v => {
                        let at = v.split(UIPackage.sep3);
                        kv[at[0]] = at[1];
                    });
                    
                    str = arr[0];
                    if (str == "char") {
                        let bg: BMGlyph = new BMGlyph();
                        bg.x = parseInt(kv.x) || 0;
                        bg.y = parseInt(kv.y) || 0;
                        bg.offsetX = parseInt(kv.xoffset) || 0;
                        bg.offsetY = parseInt(kv.yoffset) || 0;
                        bg.width = parseInt(kv.width) || 0;
                        bg.height = parseInt(kv.height) || 0;
                        maxCharHeight = Math.max(bg.height, maxCharHeight);
                        bg.advance = parseInt(kv.xadvance) || 0;
                        if (kv.chnl != undefined) {
                            bg.channel = parseInt(kv.chnl);
                            if (bg.channel == 15)
                                bg.channel = 4;
                            else if (bg.channel == 1)
                                bg.channel = 3;
                            else if (bg.channel == 2)
                                bg.channel = 2;
                            else
                                bg.channel = 1;
                        }

                        if (!ttf) {
                            if (kv.img) {
                                charImg = this.$itemsById[kv.img];
                                if (charImg != null) {
                                    charImg.load();
                                    bg.width = charImg.width;
                                    bg.height = charImg.height;
                                    bg.texture = charImg.texture;
                                }
                            }
                        }
                        else if (mainTexture != null) {
                            bg.texture = new PIXI.Texture(mainTexture.baseTexture, new PIXI.Rectangle(bg.x + atlasOffsetX, bg.y + atlasOffsetY, bg.width, bg.height));
                        }

                        if (ttf)
                            bg.lineHeight = lineHeight;
                        else {
                            if (bg.advance == 0) {
                                if (xadvance == 0)
                                    bg.advance = bg.offsetX + bg.width;
                                else
                                    bg.advance = xadvance;
                            }

                            bg.lineHeight = bg.offsetY < 0 ? bg.height : (bg.offsetY + bg.height);
                            if (size > 0 && bg.lineHeight < size)
                                bg.lineHeight = size;
                        }
                        font.glyphs[String.fromCharCode(+kv.id | 0)] = bg;
                    }
                    else if (str == "info") {
                        ttf = kv.face != null;
                        if (kv.size)
                            size = parseInt(kv.size);
                        resizable = kv.resizable == "true";
                        colorable = kv.colored == "true";
                        if (ttf) {
                            let cfg: AtlasConfig = this.$atlasConfigs[item.id];
                            if (cfg != null) {
                                atlasOffsetX = cfg.frame.x;
                                atlasOffsetY = cfg.frame.y;
                                let atlasItem: PackageItem = this.$itemsById[cfg.atlasName];
                                if (atlasItem != null)
                                    mainTexture = this.getItemAsset(atlasItem) as PIXI.Texture;
                            }
                        }
                    }
                    else if (str == "common") {
                        if (kv.lineHeight)
                            lineHeight = parseInt(kv.lineHeight);
                        if (size == 0)
                            size = lineHeight;
                        else if (lineHeight == 0)
                            lineHeight = size;
                        if (kv.xadvance)
                            xadvance = parseInt(kv.xadvance);
                    }
                }
            });

            if (size == 0 && maxCharHeight > 0)
                size = maxCharHeight;
            
            font.ttf = ttf;
            font.size = size;
            font.resizable = resizable;
            font.colorable = colorable;
            item.bitmapFont = font;
        }
    }
}