import React, { useState, useEffect, useRef, useCallback } from 'react';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';
import Spinner from './ui/Spinner';
import { SparklesIcon } from '../constants';
import { generateImageAltText } from '../services/geminiService';

interface ImageUploadModalProps {
  imageFile: File;
  postSlug: string;
  onClose: () => void;
  onUpload: (details: { file: Blob; alt: string; fullPath: string; }) => void;
}

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
});

const ImageUploadModal: React.FC<ImageUploadModalProps> = ({ imageFile, postSlug, onClose, onUpload }) => {
  const [alt, setAlt] = useState('');
  const [fileName, setFileName] =useState('');
  const [uploadPathOption, setUploadPathOption] = useState<'post' | 'shared'>('post');
  
  const [originalDims, setOriginalDims] = useState({ width: 0, height: 0 });
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [quality, setQuality] = useState(0.85);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Crop state
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [viewBox, setViewBox] = useState({ width: 0, height: 0, scale: 1 });
  
  // Resize state
  const [resizeWidth, setResizeWidth] = useState('');
  const [resizeHeight, setResizeHeight] = useState('');
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ type: string; startX: number; startY: number; initialCrop: typeof crop } | null>(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => setImageSrc(e.target?.result as string);
    reader.readAsDataURL(imageFile);

    const nameWithoutExt = imageFile.name.split('.').slice(0, -1).join('.') || 'image';
    const slugifiedName = nameWithoutExt.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    const extension = imageFile.type === 'image/jpeg' ? 'jpg' : 'png';
    setFileName(`${slugifiedName}-${Date.now()}.${extension}`);

  }, [imageFile]);
  
  useEffect(() => {
      if (crop.width > 0 && crop.height > 0) {
        const finalWidth = Math.round(crop.width * viewBox.scale);
        const finalHeight = Math.round(crop.height * viewBox.scale);
        setResizeWidth(String(finalWidth));
        setResizeHeight(String(finalHeight));
      }
  }, [crop, viewBox.scale]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const { naturalWidth, naturalHeight } = img;
    setOriginalDims({ width: naturalWidth, height: naturalHeight });
    
    const container = previewContainerRef.current;
    if (!container) return;
    
    const containerRatio = container.clientWidth / container.clientHeight;
    const imageRatio = naturalWidth / naturalHeight;

    let width, height, scale;
    if (imageRatio > containerRatio) {
        width = container.clientWidth;
        height = width / imageRatio;
        scale = naturalWidth / width;
    } else {
        height = container.clientHeight;
        width = height * imageRatio;
        scale = naturalHeight / height;
    }

    setViewBox({ width, height, scale });

    const cropWidth = width * 0.9;
    const cropHeight = height * 0.9;
    const cropX = (width - cropWidth) / 2;
    const cropY = (height - cropHeight) / 2;
    setCrop({ x: cropX, y: cropY, width: cropWidth, height: cropHeight });
  };


  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    dragStateRef.current = { type, startX: e.clientX, startY: e.clientY, initialCrop: { ...crop } };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStateRef.current) return;
    const { type, startX, startY, initialCrop } = dragStateRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let newCrop = { ...initialCrop };

    if (type === 'move') {
      newCrop.x = initialCrop.x + dx;
      newCrop.y = initialCrop.y + dy;
    } else {
        if (type.includes('n')) { newCrop.y = initialCrop.y + dy; newCrop.height = initialCrop.height - dy; }
        if (type.includes('s')) { newCrop.height = initialCrop.height + dy; }
        if (type.includes('w')) { newCrop.x = initialCrop.x + dx; newCrop.width = initialCrop.width - dx; }
        if (type.includes('e')) { newCrop.width = initialCrop.width + dx; }
    }
    
    if (newCrop.height < 20) { newCrop.height = 20; if(type.includes('n')) newCrop.y = initialCrop.y + initialCrop.height - 20; }
    if (newCrop.width < 20) { newCrop.width = 20; if(type.includes('w')) newCrop.x = initialCrop.x + initialCrop.width - 20; }
    newCrop.x = Math.max(0, Math.min(newCrop.x, viewBox.width - newCrop.width));
    newCrop.y = Math.max(0, Math.min(newCrop.y, viewBox.height - newCrop.height));
    if (newCrop.x + newCrop.width > viewBox.width) { newCrop.width = viewBox.width - newCrop.x; }
    if (newCrop.y + newCrop.height > viewBox.height) { newCrop.height = viewBox.height - newCrop.y; }
    setCrop(newCrop);
  }, [viewBox.width, viewBox.height]);

  const handleMouseUp = useCallback(() => {
    dragStateRef.current = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);
  
  const handleResizeChange = (axis: 'width' | 'height', value: string) => {
    const numValue = parseInt(value, 10);
    const croppedWidth = crop.width * viewBox.scale;
    const croppedHeight = crop.height * viewBox.scale;

    if (axis === 'width') {
      setResizeWidth(value);
      if (keepAspectRatio && !isNaN(numValue) && numValue > 0) {
        const aspectRatio = croppedHeight / croppedWidth;
        setResizeHeight(String(Math.round(numValue * aspectRatio)));
      }
    } else {
      setResizeHeight(value);
      if (keepAspectRatio && !isNaN(numValue) && numValue > 0) {
        const aspectRatio = croppedWidth / croppedHeight;
        setResizeWidth(String(Math.round(numValue * aspectRatio)));
      }
    }
  };

  const handleUpload = () => {
    if (!alt || !fileName) { alert('Alt text and filename are required.'); return; }
    if (!imgRef.current || !canvasRef.current) return;

    setIsProcessing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setIsProcessing(false); return; };
    
    const finalWidth = Math.min(parseInt(resizeWidth, 10) || Math.round(crop.width * viewBox.scale), originalDims.width);
    const finalHeight = Math.min(parseInt(resizeHeight, 10) || Math.round(crop.height * viewBox.scale), originalDims.height);
    
    canvas.width = finalWidth;
    canvas.height = finalHeight;
    
    const sourceX = Math.round(crop.x * viewBox.scale);
    const sourceY = Math.round(crop.y * viewBox.scale);
    const sourceWidth = Math.round(crop.width * viewBox.scale);
    const sourceHeight = Math.round(crop.height * viewBox.scale);

    ctx.drawImage(imgRef.current, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, finalWidth, finalHeight);

    const mimeType = imageFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const imageQuality = mimeType === 'image/jpeg' ? quality : undefined;
    
    const pathPrefix = uploadPathOption === 'post' ? `assets/img/posts/${postSlug}/` : 'assets/img/';
    const fullPath = `${pathPrefix}${fileName}`;

    canvas.toBlob((blob) => {
        if (blob) onUpload({ file: blob, alt, fullPath });
        setIsProcessing(false);
      }, mimeType, imageQuality);
  };
  
  const handleGenerateAltText = async () => {
    setIsAiLoading(true);
    try {
        const base64 = await blobToBase64(imageFile);
        const generatedAlt = await generateImageAltText(base64, imageFile.type);
        setAlt(generatedAlt);
    } catch (error) {
        console.error("Failed to generate alt text", error);
        alert("Could not generate alt text. Please check the console for errors.");
    } finally {
        setIsAiLoading(false);
    }
  };

  const cropHandles = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-5xl max-h-[90vh] flex flex-col p-6">
        <h2 className="text-xl font-bold mb-4">Crop & Upload Image</h2>
        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
          <div ref={previewContainerRef} className="flex items-center justify-center bg-black/20 rounded-md p-2 overflow-hidden h-full select-none">
            {imageSrc && (
                 <div className="relative" style={{ width: viewBox.width, height: viewBox.height }}>
                    <img ref={imgRef} src={imageSrc} alt="Pasted preview" onLoad={onImageLoad} style={{ width: '100%', height: '100%', display: originalDims.width > 0 ? 'block' : 'none' }} />
                    {originalDims.width > 0 && (
                        <>
                         <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `0 0 0 9999px rgba(0,0,0,0.5)`, top: crop.y, left: crop.x, width: crop.width, height: crop.height }}/>
                         <div className="absolute border-2 border-white/80 cursor-move" style={{ top: crop.y, left: crop.x, width: crop.width, height: crop.height }} onMouseDown={(e) => handleMouseDown(e, 'move')}>
                            {cropHandles.map(handle => ( <div key={handle} className={`absolute w-3 h-3 bg-[#7f5af0] border border-white/50 rounded-full -translate-x-1/2 -translate-y-1/2 cursor-${handle}-resize`} style={{ top: handle.includes('n') ? '0%' : handle.includes('s') ? '100%' : '50%', left: handle.includes('w') ? '0%' : handle.includes('e') ? '100%' : '50%', }} onMouseDown={(e) => handleMouseDown(e, handle)} /> ))}
                         </div>
                        </>
                    )}
                 </div>
            )}
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto pr-2">
            <div>
              <label htmlFor="alt" className="text-sm font-medium text-gray-300 block mb-1">Alt Text (Required)</label>
              <div className="flex items-center gap-2">
                <Input id="alt" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="A descriptive caption for the image" required className="flex-grow"/>
                <Button onClick={handleGenerateAltText} variant="ghost" size="icon" title="Generate Alt Text with AI" disabled={isAiLoading}>
                  {isAiLoading ? <Spinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5 text-[#00ffae]" />}
                </Button>
              </div>
            </div>
            <div>
                <label htmlFor="uploadPath" className="text-sm font-medium text-gray-300 block mb-1">Upload Path</label>
                <select id="uploadPath" value={uploadPathOption} onChange={(e) => setUploadPathOption(e.target.value as any)} className="w-full h-10 rounded-md border border-gray-700 bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7f5af0]">
                    <option value="post" className="bg-[#242424]">Post Assets (assets/img/posts/{postSlug}/)</option>
                    <option value="shared" className="bg-[#242424]">Shared Images (assets/img/)</option>
                </select>
            </div>
            <div>
              <label htmlFor="fileName" className="text-sm font-medium text-gray-300 block mb-1">Filename</label>
              <Input id="fileName" value={fileName} onChange={(e) => setFileName(e.target.value)} required />
            </div>
            
            <div className="border-t border-white/10 pt-4">
                <h3 className="text-base font-semibold mb-2">Resize</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="width" className="text-sm font-medium text-gray-300 block mb-1">Width (px)</label>
                        <Input id="width" type="number" value={resizeWidth} onChange={e => handleResizeChange('width', e.target.value)} />
                    </div>
                    <div>
                        <label htmlFor="height" className="text-sm font-medium text-gray-300 block mb-1">Height (px)</label>
                        <Input id="height" type="number" value={resizeHeight} onChange={e => handleResizeChange('height', e.target.value)} />
                    </div>
                </div>
                 <div className="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="aspectRatio" checked={keepAspectRatio} onChange={e => setKeepAspectRatio(e.target.checked)} className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-[#7f5af0] focus:ring-[#7f5af0]"/>
                    <label htmlFor="aspectRatio" className="text-sm text-gray-400">Lock aspect ratio</label>
                 </div>
                {originalDims.width > 0 && <p className="text-xs text-gray-500 mt-2">Cropped: {Math.round(crop.width * viewBox.scale)} x {Math.round(crop.height * viewBox.scale)} px. Max size is original dimensions.</p>}
            </div>
            
            {imageFile.type === 'image/jpeg' && (
                <div className="border-t border-white/10 pt-4">
                    <label htmlFor="quality" className="text-sm font-medium text-gray-300 block mb-1">JPEG Quality: {Math.round(quality * 100)}%</label>
                    <input id="quality" type="range" min="0.1" max="1" step="0.05" value={quality} onChange={e => setQuality(parseFloat(e.target.value))} className="w-full" />
                </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-white/10">
          <Button onClick={onClose} variant="secondary" disabled={isProcessing}>Cancel</Button>
          <Button onClick={handleUpload} variant="primary" disabled={isProcessing} className="gap-2">
            {isProcessing && <Spinner className="w-4 h-4" />}
            Upload & Insert
          </Button>
        </div>
      </Card>
      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
};

export default ImageUploadModal;
