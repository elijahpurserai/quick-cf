import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

import { cn } from "./ui/utils";
import { Badge } from "./ui/badge";
import { Sparkles, Plus, X, ChevronDown, Lock, Globe, Check, Link2 } from "lucide-react";
import { EDUCATION_CATEGORIES, DURATION_OPTIONS, StoryFormData, HeroProfile, Visibility } from "../types";
import { SUPPORTED_LANGUAGES, AGE_RANGE, MAX_CUSTOM_DURATION } from "../config";
import { useLanguage } from "../contexts/LanguageContext";
import { useApp } from "../contexts/AppContext";
import { LoginRequiredModal } from "./LoginRequiredModal";

// Maps English category values to i18n keys
const EDUCATION_CATEGORY_KEYS: Record<string, string> = {
  "Emotional Intelligence": "storyForm.catEmotionalIntelligence",
  "Sharing": "storyForm.catSharing",
  "Confidence": "storyForm.catConfidence",
  "Dealing with Fear": "storyForm.catDealingWithFear",
  "Potty Training": "storyForm.catPottyTraining",
  "First Day of School": "storyForm.catFirstDayOfSchool",
  "Bullying": "storyForm.catBullying",
  "Losing a Tooth": "storyForm.catLosingATooth",
  "Bedtime Anxiety": "storyForm.catBedtimeAnxiety",
  "Healthy Eating": "storyForm.catHealthyEating",
  "Other": "storyForm.catOther",
};

// Maps duration values to i18n keys
const DURATION_LABEL_KEYS: Record<number, string> = {
  7: "storyForm.duration7",
  10: "storyForm.duration10",
  15: "storyForm.duration15",
  0: "storyForm.durationCustom",
};

// Maps gender values to i18n keys
const GENDER_LABEL_KEYS: Record<string, string> = {
  male: "storyForm.genderMale",
  female: "storyForm.genderFemale",
  unspecified: "storyForm.genderUnspecified",
};

interface StoryGeneratorFormProps {
  onGenerate: (formData: StoryFormData) => void;
}

type TFn = (key: string, params?: Record<string, string | number>) => string;

export function StoryGeneratorForm({ onGenerate }: StoryGeneratorFormProps) {
  const { t, isRTL, lang } = useLanguage();
  const { user, heroProfiles, saveHeroProfiles } = useApp();

  // Profile picker state
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const selectedProfileIdRef = useRef<string | null>(null);
  const heroProfilesRef = useRef<HeroProfile[]>(heroProfiles);
  const profileInitialized = useRef(false);
  const suppressSave = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unified topic: "adventure", an education category name, or "Other"
  const [topic, setTopic] = useState("adventure");
  const [childName, setChildName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [age, setAge] = useState("");
  const [educationGoal, setEducationGoal] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [siblingNames, setSiblingNames] = useState<
    { name: string; gender: "male" | "female" | "unspecified" }[]
  >([]);
  const [newSibling, setNewSibling] = useState("");
  const [newSiblingGender, setNewSiblingGender] = useState<
    "male" | "female" | null
  >(null);
  const [pets, setPets] = useState<
    { name: string; type: string }[]
  >([]);
  const [newPetName, setNewPetName] = useState("");
  const [newPetType, setNewPetType] = useState("");
  const [parentNames, setParentNames] = useState<
    { name: string; gender: "male" | "female" | "unspecified" }[]
  >([]);
  const [newParent, setNewParent] = useState("");
  const [newParentGender, setNewParentGender] = useState<
    "male" | "female" | null
  >(null);
  const [durationOption, setDurationOption] = useState("7");
  const [customDuration, setCustomDuration] = useState("");
  const [language, setLanguage] = useState("en");
  const [showOptions, setShowOptions] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const [optionsHeight, setOptionsHeight] = useState(0);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Keep refs in sync
  useEffect(() => { heroProfilesRef.current = heroProfiles; }, [heroProfiles]);
  useEffect(() => { selectedProfileIdRef.current = selectedProfileId; }, [selectedProfileId]);

  /** Fill all form fields from a HeroProfile without triggering an auto-save. */
  const applyProfile = useCallback((profile: HeroProfile) => {
    suppressSave.current = true;
    setChildName(profile.childName ?? "");
    setGender(profile.gender === "unspecified" ? null : (profile.gender as "male" | "female"));
    setAge(profile.age != null ? String(profile.age) : "");
    setSiblingNames(profile.siblingNames ?? []);
    setPets(profile.pets ?? []);
    setParentNames(profile.parentNames ?? []);
    setLanguage(profile.language ?? lang);
  }, [lang]);

  // Auto-select and apply the first profile on initial load
  useEffect(() => {
    if (!profileInitialized.current && heroProfiles.length > 0) {
      profileInitialized.current = true;
      setSelectedProfileId(heroProfiles[0].id);
      applyProfile(heroProfiles[0]);
    }
  }, [heroProfiles, applyProfile]);

  // Sync story language when the interface language changes (only if no profile has been loaded yet)
  useEffect(() => {
    if (!profileInitialized.current) {
      setLanguage(lang);
    }
  }, [lang]);

  // Debounced auto-save: write form state back to the selected profile
  useEffect(() => {
    if (suppressSave.current) {
      suppressSave.current = false;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const profileData = {
        childName,
        gender: (gender || "unspecified") as HeroProfile["gender"],
        age: age ? parseInt(age) : null,
        siblingNames,
        pets,
        parentNames,
        language,
      };
      const currentId = selectedProfileIdRef.current;
      if (currentId) {
        const updated = heroProfilesRef.current.map((p) =>
          p.id === currentId ? { ...p, ...profileData } : p
        );
        saveHeroProfiles(updated);
      } else if (childName.trim()) {
        // First time a guest or new user fills in a name — create a profile automatically
        const newId = crypto.randomUUID();
        setSelectedProfileId(newId);
        selectedProfileIdRef.current = newId;
        saveHeroProfiles([...heroProfilesRef.current, { id: newId, ...profileData }]);
      }
    }, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childName, gender, age, siblingNames, pets, parentNames, language, saveHeroProfiles]);

  useEffect(() => {
    if (optionsRef.current) {
      setOptionsHeight(optionsRef.current.scrollHeight);
    }
  });

  const handleAddSibling = () => {
    if (newSibling.trim()) {
      setSiblingNames([
        ...siblingNames,
        { name: newSibling.trim(), gender: newSiblingGender || "unspecified" },
      ]);
      setNewSibling("");
      setNewSiblingGender(null);
    }
  };

  const handleRemoveSibling = (index: number) => {
    setSiblingNames(siblingNames.filter((_, i) => i !== index));
  };

  const handleAddParent = () => {
    if (newParent.trim()) {
      setParentNames([
        ...parentNames,
        { name: newParent.trim(), gender: newParentGender || "unspecified" },
      ]);
      setNewParent("");
      setNewParentGender(null);
    }
  };

  const handleRemoveParent = (index: number) => {
    setParentNames(parentNames.filter((_, i) => i !== index));
  };

  const handleAddPet = () => {
    if (newPetName.trim()) {
      setPets([
        ...pets,
        { name: newPetName.trim(), type: newPetType.trim() || "pet" },
      ]);
      setNewPetName("");
      setNewPetType("");
    }
  };

  const handleRemovePet = (index: number) => {
    setPets(pets.filter((_, i) => i !== index));
  };

  const handleVisibilityChange = (value: Visibility) => {
    if (value === "private" && !user) {
      setShowLoginModal(true);
      return;
    }
    setVisibility(value);
  };

  const handleSelectProfile = (profile: HeroProfile) => {
    setSelectedProfileId(profile.id);
    applyProfile(profile);
  };

  const handleNewProfile = () => {
    suppressSave.current = true;
    setSelectedProfileId(null);
    selectedProfileIdRef.current = null;
    setChildName("");
    setGender(null);
    setAge("");
    setSiblingNames([]);
    setPets([]);
    setParentNames([]);
  };

  const handleDeleteProfile = (profileId: string) => {
    const updated = heroProfilesRef.current.filter((p) => p.id !== profileId);
    saveHeroProfiles(updated);
    if (selectedProfileIdRef.current === profileId) {
      if (updated.length > 0) {
        setSelectedProfileId(updated[0].id);
        applyProfile(updated[0]);
      } else {
        handleNewProfile();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const duration =
      durationOption === "0"
        ? parseInt(customDuration) || 5
        : parseInt(durationOption);

    // Derive purpose + educationCategory from unified topic
    const isAdventure = topic === "adventure";
    const isOther = topic === "Other";
    const isEducation = !isAdventure && !isOther;

    const formData: StoryFormData = {
      purpose: isAdventure ? "adventure" : isOther ? "custom" : "education",
      childName,
      gender: gender || "unspecified",
      age: parseInt(age),
      educationGoal: isOther ? educationGoal : undefined,
      educationCategory: isEducation ? topic : undefined,
      additionalInfo,
      siblingNames,
      pets,
      parentNames,
      duration,
      language,
      visibility,
    };

    onGenerate(formData);
  };

  return (
    <Card className="border-purple-200 shadow-lg relative overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
      {/* Decorative corner elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-100 to-transparent rounded-bl-full opacity-50" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-pink-100 to-transparent rounded-tr-full opacity-50" />

      <CardHeader className="bg-gradient-to-r from-purple-50 via-pink-50 to-blue-50 relative z-10">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-purple-600 animate-pulse" />
          {t("storyForm.title")}
        </CardTitle>

        {/* Hero Profile Picker */}
        {heroProfiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {heroProfiles.map((profile) => (
              <div key={profile.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleSelectProfile(profile)}
                  className={cn(
                    "flex items-center gap-1 text-xs rounded-full px-2.5 py-1 transition-colors border",
                    selectedProfileId === profile.id
                      ? "bg-purple-600 border-purple-600 text-white"
                      : "bg-white border-purple-200 text-purple-600 hover:bg-purple-50 hover:border-purple-400"
                  )}
                >
                  {profile.childName || "—"}
                  {profile.age ? `, ${profile.age}` : ""}
                </button>
                {selectedProfileId === profile.id && (
                  <button
                    type="button"
                    onClick={() => handleDeleteProfile(profile.id)}
                    title={t("storyForm.deleteProfileTitle")}
                    className="ms-0.5 p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleNewProfile}
              title={t("storyForm.newProfileTitle")}
              className="flex items-center gap-1 text-xs bg-white border border-dashed border-purple-300 text-purple-400 hover:bg-purple-50 hover:border-purple-400 rounded-full px-2.5 py-1 transition-colors"
            >
              <Plus className="size-3" />
              {t("storyForm.newProfile")}
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-6 relative z-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Language Selection */}
          <div className="space-y-2">
            <Label>{t("storyForm.storyLanguage")}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>{lang.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Child Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="childName">{t("storyForm.childName")} *</Label>
              <Input
                id="childName"
                required
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder={t("storyForm.childNamePlaceholder")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age">{t("storyForm.age")} *</Label>
                <Input
                  id="age"
                  type="number"
                  required
                  min={AGE_RANGE.min.toString()}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder={t("storyForm.agePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("storyForm.gender")}</Label>
                <div className="flex gap-2">
                  {[
                    { id: "male", label: t("storyForm.genderMale"), letter: t("storyForm.genderMaleLetter"), activeClass: "border-blue-500 bg-blue-50 text-blue-700" },
                    { id: "female", label: t("storyForm.genderFemale"), letter: t("storyForm.genderFemaleLetter"), activeClass: "border-pink-500 bg-pink-50 text-pink-700" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setGender(gender === opt.id ? null : opt.id as any)}
                      className={cn(
                        "flex-1 flex items-center justify-center p-2 rounded-lg border-2 transition-all",
                        gender === opt.id
                          ? `${opt.activeClass} shadow-sm scale-105`
                          : "border-gray-100 hover:border-purple-200 text-gray-400 hover:bg-gray-50"
                      )}
                      title={opt.label}
                    >
                      <span className="sm:hidden text-sm font-semibold">{opt.letter}</span>
                      <span className="hidden sm:inline text-sm font-semibold">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Story Idea - required */}
          <div className="space-y-2">
            <Label htmlFor="additionalInfo">{t("storyForm.storyIdea")}</Label>
            <Textarea
              id="additionalInfo"

              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder={t("storyForm.storyIdeaPlaceholder")}
              rows={3}
            />
          </div>

          {/* Story Topic Dropdown */}
          <div className="space-y-2">
            <Label>{t("storyForm.storyPurpose")}</Label>
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adventure">{t("storyForm.purposeAdventure")}</SelectItem>
                {EDUCATION_CATEGORIES.filter(cat => cat !== "Other").map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(EDUCATION_CATEGORY_KEYS[cat] || cat)}
                  </SelectItem>
                ))}
                <SelectItem value="Other">{t("storyForm.purposeOther")}</SelectItem>
              </SelectContent>
            </Select>

            {topic === "Other" && (
              <div className="mt-2">
                <Input
                  placeholder={t("storyForm.educationGoalPlaceholder")}
                  value={educationGoal}
                  onChange={(e) => setEducationGoal(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Collapsible Optional Fields */}
          <div className="border border-purple-100 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50/50 to-pink-50/50 hover:from-purple-50 hover:to-pink-50 transition-colors text-start"
            >
              <span className="text-sm font-medium text-purple-700">{t("storyForm.personalize")}</span>
              <ChevronDown
                className={cn(
                  "size-4 text-purple-500 transition-transform duration-200",
                  showOptions && "rotate-180"
                )}
              />
            </button>

            {/* Entity badges when collapsed */}
            {!showOptions && (siblingNames.length > 0 || parentNames.length > 0 || pets.length > 0) && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-3 -mt-1">
                {siblingNames.map((s, i) => (
                  <Badge key={`sib-${i}`} variant="secondary" className="text-xs bg-purple-50 text-purple-600 border border-purple-100">
                    👫 {s.name}
                  </Badge>
                ))}
                {parentNames.map((p, i) => (
                  <Badge key={`par-${i}`} variant="secondary" className="text-xs bg-pink-50 text-pink-600 border border-pink-100">
                    👨‍👩‍👧 {p.name}
                  </Badge>
                ))}
                {pets.map((p, i) => (
                  <Badge key={`pet-${i}`} variant="secondary" className="text-xs bg-amber-50 text-amber-600 border border-amber-100">
                    🐾 {p.name}{p.type ? ` (${p.type})` : ""}
                  </Badge>
                ))}
              </div>
            )}

            <div
              style={{ maxHeight: showOptions ? optionsHeight : 0 }}
              className="transition-[max-height] duration-300 ease-in-out overflow-hidden"
            >
              <div ref={optionsRef} className="p-4 space-y-6 border-t border-purple-100">
                {/* Story Duration */}
                <div className="space-y-2">
                  <Label>{t("storyForm.storyDuration")}</Label>
                  <Select value={durationOption} onValueChange={setDurationOption}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {t(DURATION_LABEL_KEYS[option.value] || option.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {durationOption === "0" && (
                    <div className="mt-2">
                      <Input
                        type="number"
                        min="1"
                        max={MAX_CUSTOM_DURATION.toString()}
                        value={customDuration}
                        onChange={(e) => setCustomDuration(e.target.value)}
                        placeholder={t("storyForm.enterMinutes")}
                      />
                    </div>
                  )}
                </div>


                {/* Siblings */}
                <div className="space-y-2">
                  <Label>{t("storyForm.addSiblings")}</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Input
                      value={newSibling}
                      onChange={(e) => setNewSibling(e.target.value)}
                      placeholder={t("storyForm.siblingPlaceholder")}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddSibling();
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <div className="flex-1 flex gap-1">
                        {[
                          { id: "male", label: t("storyForm.genderMale"), letter: t("storyForm.genderMaleLetter"), activeClass: "border-blue-400 bg-blue-50 text-blue-600" },
                          { id: "female", label: t("storyForm.genderFemale"), letter: t("storyForm.genderFemaleLetter"), activeClass: "border-pink-400 bg-pink-50 text-pink-600" },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setNewSiblingGender(newSiblingGender === opt.id ? null : opt.id as any)}
                            className={cn(
                              "flex-1 flex items-center justify-center p-2 rounded-lg border-2 transition-all",
                              newSiblingGender === opt.id
                                ? opt.activeClass
                                : "border-gray-100 text-gray-400 hover:bg-gray-50"
                            )}
                            title={opt.label}
                          >
                            <span className="sm:hidden text-sm font-semibold">{opt.letter}</span>
                            <span className="hidden sm:inline text-sm font-semibold">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                      <Button type="button" onClick={handleAddSibling} size="sm">
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                  {siblingNames.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {siblingNames.map((sibling, index) => (
                        <div
                          key={index}
                          className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full flex items-center gap-2"
                        >
                          <span>
                            {sibling.name} ({t(GENDER_LABEL_KEYS[sibling.gender] || sibling.gender)})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSibling(index)}
                            className="hover:text-purple-900"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pets */}
                <div className="space-y-2">
                  <Label>{t("storyForm.addPets")}</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Input
                      value={newPetName}
                      onChange={(e) => setNewPetName(e.target.value)}
                      placeholder={t("storyForm.petNamePlaceholder")}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddPet();
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <Input
                        value={newPetType}
                        onChange={(e) => setNewPetType(e.target.value)}
                        placeholder={t("storyForm.petTypePlaceholder")}
                        className="flex-1"
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddPet();
                          }
                        }}
                      />
                      <Button type="button" onClick={handleAddPet} size="sm">
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                  {pets.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {pets.map((pet, index) => (
                        <div
                          key={index}
                          className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full flex items-center gap-2"
                        >
                          <span>
                            {pet.name} ({pet.type})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemovePet(index)}
                            className="hover:text-amber-900"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Parent Names */}
                <div className="space-y-2">
                  <Label>{t("storyForm.addParents")}</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Input
                      value={newParent}
                      onChange={(e) => setNewParent(e.target.value)}
                      placeholder={t("storyForm.parentPlaceholder")}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddParent();
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <div className="flex-1 flex gap-1">
                        {[
                          { id: "male", label: t("storyForm.genderMale"), letter: t("storyForm.genderMaleLetter"), activeClass: "border-blue-400 bg-blue-50 text-blue-600" },
                          { id: "female", label: t("storyForm.genderFemale"), letter: t("storyForm.genderFemaleLetter"), activeClass: "border-pink-400 bg-pink-50 text-pink-600" },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setNewParentGender(newParentGender === opt.id ? null : opt.id as any)}
                            className={cn(
                              "flex-1 flex items-center justify-center p-2 rounded-lg border-2 transition-all",
                              newParentGender === opt.id
                                ? opt.activeClass
                                : "border-gray-100 text-gray-400 hover:bg-gray-50"
                            )}
                            title={opt.label}
                          >
                            <span className="sm:hidden text-sm font-semibold">{opt.letter}</span>
                            <span className="hidden sm:inline text-sm font-semibold">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                      <Button type="button" onClick={handleAddParent} size="sm">
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                  {parentNames.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {parentNames.map((parent, index) => (
                        <div
                          key={index}
                          className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full flex items-center gap-2"
                        >
                          <span>
                            {parent.name} ({t(GENDER_LABEL_KEYS[parent.gender] || parent.gender)})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveParent(index)}
                            className="hover:text-pink-900"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>


          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            size="lg"
          >
            <Sparkles className="size-5 me-2" />
            {t("storyForm.generateStory")}
          </Button>

          {/* Visibility Selector */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "public" as Visibility, icon: Globe, label: t("privateMode.publicLabel"), sub: t("privateMode.publicSub"), color: "gray" },
              { value: "unlisted" as Visibility, icon: Link2, label: t("privateMode.unlistedLabel"), sub: t("privateMode.unlistedSub"), color: "amber" },
              { value: "private" as Visibility, icon: Lock, label: t("privateMode.privateLabel"), sub: t("privateMode.privateSub"), color: "purple" },
            ]).map(({ value, icon: Icon, label, sub, color }) => {
              const selected = visibility === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleVisibilityChange(value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all duration-200 text-center",
                    selected
                      ? `border-${color}-400 bg-${color}-50 hover:bg-${color}-100`
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                  )}
                  style={selected ? {
                    borderColor: color === "purple" ? "#c084fc" : color === "amber" ? "#fbbf24" : "#d1d5db",
                    backgroundColor: color === "purple" ? "#faf5ff" : color === "amber" ? "#fffbeb" : "#f9fafb",
                  } : undefined}
                >
                  <div className={cn(
                    "size-8 rounded-full flex items-center justify-center",
                    selected
                      ? color === "purple" ? "bg-purple-600 text-white"
                        : color === "amber" ? "bg-amber-500 text-white"
                        : "bg-gray-500 text-white"
                      : "bg-white text-gray-400 border border-gray-200"
                  )}>
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className={cn("text-sm font-semibold leading-none mb-0.5",
                      selected
                        ? color === "purple" ? "text-purple-700"
                          : color === "amber" ? "text-amber-700"
                          : "text-gray-700"
                        : "text-gray-700"
                    )}>
                      {label}
                    </p>
                    <p className={cn("text-xs",
                      selected
                        ? color === "purple" ? "text-purple-500"
                          : color === "amber" ? "text-amber-500"
                          : "text-gray-400"
                        : "text-gray-400"
                    )}>
                      {sub}
                    </p>
                  </div>
                  <div className={cn(
                    "size-4 rounded-full border-2 flex items-center justify-center transition-colors",
                    selected
                      ? color === "purple" ? "border-purple-600 bg-purple-600"
                        : color === "amber" ? "border-amber-500 bg-amber-500"
                        : "border-gray-500 bg-gray-500"
                      : "border-gray-300 bg-white"
                  )}>
                    {selected && <Check className="size-2.5 text-white" strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>
        </form>
      </CardContent>

      <LoginRequiredModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={() => setVisibility("private")}
      />
    </Card>
  );
}