# Create FHIR ImagingStudy Object from DICOM objects

## Purpose
Create a FHIR ImagingStudy JSON from local DICOM files or a DICOMweb server.

## Demo site
* [Create FHIR ImagingStudy JSON from a DICOMweb Server](https://cylab-tw.github.io/dicom-to-fhir/Server/index.html)
* **Note:** If using Chrome, add this argument to your Chrome shortcut
```
--user-data-dir="C:/Chrome dev session2" --disable-web-security
```

![](https://hackmd.io/_uploads/BJDIcEqeT.png)

## Create JSON from local DICOM files
* create FHIR ImagingStudy regarding the FHIR R4 base
* examples including C#, Node.js, Python
* It should be modified if you want to create another specification. e.g., Taiwan PAS ImagingStudy Profile.

## Create JSON from a DICOMweb Server
* A simple HTML page to query/retrieve the DICOM image from a DICOMweb server
* In this demonstration, the DICOMweb server utilizes [raccoon](https://github.com/cylab-tw/raccoon). It is compatible with any DICOMweb-compatible PACS server such as Orthanc, DCM4CHEE, etc.
* This example uses simple JavaScript syntax to show how to connect a DICOMweb server.
* The FHIR specification is based [Taiwan PAS ImagingStudy Profile](https://twcore.mohw.gov.tw/ig/pas/StructureDefinition-ImagingStudy-twpas.html)
  
## Acknowledgements
* [@ppop123456](https://github.com/ppop123456)
* [@a5566qq123](https://github.com/Chinlinlee)

