// discover.me — Configurație și starea comună a aplicației (versiuni, modele, date încărcate).
'use strict';

const MODEL_BASE='https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';
const ENGINE_VERSION='dm2-faceapi-1.7.12-adaptive-v2-clothes';
const MATCH_ALGORITHM_VERSION='consensus-3refs-v4-clothes';
const DB_NAME='discover-me-v2', DB_VERSION=1;
let db=null, engineReady=false, activeFiles=[], currentAlbumName='', directoryHandle=null, currentAlbumId='';
let people=[], referenceDescriptors=[], referenceThumbs=[], draftDescriptors=[], draftThumbs=[], draftFileKeys=new Set(), selectedPersonId=null;
let indexedEntries=[], latestHits=[], busy=false, pauseRequested=false, toastTimer=null, previewUrl=null;
let indexRevision=0, returnToSearchAfterIndex=false, returnToSearchAfterPersonCreation=false;
