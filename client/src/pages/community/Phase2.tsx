import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Store, Shield, Clock, Star } from "lucide-react";

// Simple fetch function for API requests
const apiRequest = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('API request failed');
  return response.json();
};

interface Business {
  id: string;
  name: string;
  description: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string;
  website?: string;
  isVerified: boolean;
}

interface Event {
  id: string;
  title: string;
  description: string;
  category: string;
  startTime: string;
  endTime: string;
  isPromotion: boolean;
  promotionCode?: string;
  organizerId: string;
  businessId?: string;
}

interface DrivebyRequest {
  id: string;
  title: string;
  description: string;
  priority: string;
  state: string;
  requestedTime?: string;
  acceptedAt?: string;
  completedAt?: string;
  estimatedArrival?: string;
}

export default function Phase2() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  // Get user location for nearby queries
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          // Fallback to Windhoek, Namibia
          setUserLocation({ lat: -22.5609, lng: 17.0658 });
        }
      );
    }
  }, []);

  // Fetch nearby businesses
  const { data: businesses = [] } = useQuery<Business[]>({
    queryKey: ['businesses', 'nearby', userLocation?.lat, userLocation?.lng],
    queryFn: () => userLocation 
      ? apiRequest(`/api/businesses/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}`)
      : Promise.resolve([]),
    enabled: !!userLocation
  });

  // Fetch nearby events
  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['events', 'nearby', userLocation?.lat, userLocation?.lng],
    queryFn: () => userLocation 
      ? apiRequest(`/api/events/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}`)
      : Promise.resolve([]),
    enabled: !!userLocation
  });

  // Fetch promotions
  const { data: promotions = [] } = useQuery<Event[]>({
    queryKey: ['promotions', 'nearby', userLocation?.lat, userLocation?.lng],
    queryFn: () => userLocation 
      ? apiRequest(`/api/promotions/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}`)
      : Promise.resolve([]),
    enabled: !!userLocation
  });

  // Fetch user's drive-by requests
  const { data: userRequests = [] } = useQuery<DrivebyRequest[]>({
    queryKey: ['driveby-requests'],
    queryFn: () => apiRequest('/api/driveby-requests')
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'restaurant': return '🍽️';
      case 'retail': return '🛍️';
      case 'healthcare': return '🏥';
      case 'security': return '🛡️';
      case 'education': return '📚';
      default: return '🏪';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'en_route': return 'bg-blue-100 text-blue-800';
      case 'accepted': return 'bg-purple-100 text-purple-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="page-phase2">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4" data-testid="text-title">
            🌟 Phase 2: Community Enhanced Features
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto" data-testid="text-description">
            Experience NaborNet's expanded community platform with local business directory, 
            community events, promotional offers, and drive-by security request services.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card data-testid="card-businesses-stat">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Store className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-businesses-count">
                    {businesses.length}
                  </p>
                  <p className="text-sm text-gray-600">Local Businesses</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-events-stat">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Calendar className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-events-count">
                    {events.length}
                  </p>
                  <p className="text-sm text-gray-600">Upcoming Events</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-promotions-stat">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Star className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-promotions-count">
                    {promotions.length}
                  </p>
                  <p className="text-sm text-gray-600">Active Promotions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-requests-stat">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Shield className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-requests-count">
                    {userRequests.length}
                  </p>
                  <p className="text-sm text-gray-600">Security Requests</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Local Businesses Directory */}
        <Card data-testid="card-businesses-directory">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Store className="h-6 w-6 text-blue-600" />
              <span>Local Business Directory</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {businesses.length === 0 ? (
              <p className="text-gray-500 text-center py-8" data-testid="text-no-businesses">
                No verified businesses found in your area.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {businesses.map((business) => (
                  <Card key={business.id} className="hover:shadow-md transition-shadow" data-testid={`card-business-${business.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg" data-testid={`text-business-name-${business.id}`}>
                          {getCategoryIcon(business.category)} {business.name}
                        </h3>
                        {business.isVerified && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800" data-testid={`badge-verified-${business.id}`}>
                            ✓ Verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2" data-testid={`text-business-description-${business.id}`}>
                        {business.description}
                      </p>
                      <div className="flex items-center text-xs text-gray-500 mb-2">
                        <MapPin className="h-3 w-3 mr-1" />
                        <span data-testid={`text-business-address-${business.id}`}>{business.address}</span>
                      </div>
                      <Badge variant="outline" className="capitalize" data-testid={`badge-category-${business.id}`}>
                        {business.category}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Community Events */}
        <Card data-testid="card-community-events">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-6 w-6 text-green-600" />
              <span>Community Events</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-gray-500 text-center py-8" data-testid="text-no-events">
                No upcoming events in your area.
              </p>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <Card key={event.id} className="hover:shadow-md transition-shadow" data-testid={`card-event-${event.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg" data-testid={`text-event-title-${event.id}`}>
                          {event.title}
                        </h3>
                        {event.isPromotion && (
                          <Badge className="bg-yellow-100 text-yellow-800" data-testid={`badge-promotion-${event.id}`}>
                            🏷️ Promotion
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-3" data-testid={`text-event-description-${event.id}`}>
                        {event.description}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          <span data-testid={`text-event-time-${event.id}`}>
                            {new Date(event.startTime).toLocaleDateString()} at {new Date(event.startTime).toLocaleTimeString()}
                          </span>
                        </div>
                        <Badge variant="outline" className="capitalize" data-testid={`badge-event-category-${event.id}`}>
                          {event.category}
                        </Badge>
                      </div>
                      {event.promotionCode && (
                        <div className="mt-3 p-2 bg-yellow-50 rounded-md">
                          <p className="text-sm font-medium text-yellow-800" data-testid={`text-promo-code-${event.id}`}>
                            Promo Code: <span className="font-bold">{event.promotionCode}</span>
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Drive-by Security Requests */}
        <Card data-testid="card-security-requests">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-purple-600" />
              <span>Your Security Requests</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userRequests.length === 0 ? (
              <p className="text-gray-500 text-center py-8" data-testid="text-no-requests">
                No security requests found. You can request drive-by security checks for your property or area.
              </p>
            ) : (
              <div className="space-y-4">
                {userRequests.map((request) => (
                  <Card key={request.id} className="hover:shadow-md transition-shadow" data-testid={`card-request-${request.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg" data-testid={`text-request-title-${request.id}`}>
                          {request.title}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${getPriorityColor(request.priority)}`} data-testid={`indicator-priority-${request.id}`}></div>
                          <Badge className={getStateColor(request.state)} data-testid={`badge-state-${request.id}`}>
                            {request.state.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-3" data-testid={`text-request-description-${request.id}`}>
                        {request.description}
                      </p>
                      <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                        <div>
                          <span className="font-medium">Priority:</span> 
                          <span className="ml-1 capitalize" data-testid={`text-request-priority-${request.id}`}>
                            {request.priority}
                          </span>
                        </div>
                        {request.estimatedArrival && (
                          <div>
                            <span className="font-medium">ETA:</span> 
                            <span className="ml-1" data-testid={`text-request-eta-${request.id}`}>
                              {new Date(request.estimatedArrival).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                        {request.requestedTime && (
                          <div>
                            <span className="font-medium">Requested:</span> 
                            <span className="ml-1" data-testid={`text-request-time-${request.id}`}>
                              {new Date(request.requestedTime).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {request.completedAt && (
                          <div>
                            <span className="font-medium">Completed:</span> 
                            <span className="ml-1" data-testid={`text-request-completed-${request.id}`}>
                              {new Date(request.completedAt).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Information */}
        <Card className="bg-blue-50" data-testid="card-api-info">
          <CardHeader>
            <CardTitle className="text-blue-900">🚀 Phase 2 Features Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">Local Business Directory</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Verified business listings</li>
                  <li>• Category filtering</li>
                  <li>• Location-based search</li>
                  <li>• Business owner management</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">Community Events</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Event scheduling</li>
                  <li>• Promotional campaigns</li>
                  <li>• Business-sponsored events</li>
                  <li>• Time-based filtering</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">Drive-by Security</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Security check requests</li>
                  <li>• Priority-based queuing</li>
                  <li>• Real-time status updates</li>
                  <li>• Security firm management</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}