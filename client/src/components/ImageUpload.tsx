import { useState, ChangeEvent } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface ImageUploadProps {
  onImagesSelected: (files: File[]) => void;
  maxImages?: number;
  maxSize?: number; // in MB
  accept?: string;
  className?: string;
}

export default function ImageUpload({ 
  onImagesSelected, 
  maxImages = 5, 
  maxSize = 10, 
  accept = "image/*",
  className = ""
}: ImageUploadProps) {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const { toast } = useToast();

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate file count
    if (files.length + selectedImages.length > maxImages) {
      toast({
        title: "Too many images",
        description: `Maximum ${maxImages} images allowed`,
        variant: "destructive",
      });
      return;
    }

    // Validate file sizes
    const oversizedFiles = files.filter(file => file.size > maxSize * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${maxSize}MB`,
        variant: "destructive",
      });
      return;
    }

    // Create previews
    const newPreviews: string[] = [];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviews.push(e.target?.result as string);
        if (newPreviews.length === files.length) {
          const updatedImages = [...selectedImages, ...files];
          const updatedPreviews = [...previews, ...newPreviews];
          
          setSelectedImages(updatedImages);
          setPreviews(updatedPreviews);
          onImagesSelected(updatedImages);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    const updatedImages = selectedImages.filter((_, i) => i !== index);
    const updatedPreviews = previews.filter((_, i) => i !== index);
    
    setSelectedImages(updatedImages);
    setPreviews(updatedPreviews);
    onImagesSelected(updatedImages);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Button */}
      <div className="flex items-center justify-center w-full">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-8 h-8 mb-2 text-gray-400" />
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">
              PNG, JPG or GIF (MAX {maxSize}MB, {maxImages} files)
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept={accept}
            multiple
            onChange={handleFileSelect}
            data-testid="image-upload-input"
          />
        </label>
      </div>

      {/* Image Previews */}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {previews.map((preview, index) => (
            <Card key={index} className="relative p-2">
              <div className="aspect-square relative">
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover rounded"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute -top-2 -right-2 rounded-full w-6 h-6 p-0"
                  onClick={() => removeImage(index)}
                  data-testid={`remove-image-${index}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1 truncate">
                {selectedImages[index]?.name}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Selected Images Count */}
      {selectedImages.length > 0 && (
        <p className="text-sm text-gray-600">
          {selectedImages.length} of {maxImages} images selected
        </p>
      )}
    </div>
  );
}
